#!/usr/bin/env python3
"""Read only publicly available Valve A2S_INFO/A2S_RULES and publish safe JSON.

This does not read Garry's Mod net messages, internal Lua globals or private RCON.
"""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path

ADDRESS = ("45.12.63.132", 27015)
# Export only known, intentionally published cvars. Do not publish all rules blindly.
ALLOWED_NPP_RULES = (
    "NC_Station_KW", "NC_Reserve_KW", "NC_Reserve_Fuel",
    "Syndicate_CityPower_Gen", "Syndicate_CityPower_Load",
    "Syndicate_City_Blackout", "Syndicate_NPP_Fuel", "Syndicate_NPP_State",
)

def number(raw):
    try:
        value = float(str(raw).strip())
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None

def bool_value(raw):
    v = str(raw).strip().lower()
    if v in ("1", "true", "yes", "on"): return True
    if v in ("0", "false", "no", "off"): return False
    return None

def safe_text(raw, max_length=170):
    return str(raw or "").replace("\x00", "")[:max_length]

def extract_npp(public_rules):
    """Return partial NPP data only where a concrete public rule is present.

    Never guess Steam vars, units, reactor state or values hidden in net messages.
    """
    canonical={k.lower(): v for k,v in public_rules.items()}
    exposed={}
    for name in ALLOWED_NPP_RULES:
        if name.lower() in canonical:
            exposed[name]=safe_text(canonical[name.lower()],70)
    city={}
    for source,target in (("NC_Station_KW","station"),
                          ("NC_Reserve_KW","reserve"),
                          ("Syndicate_CityPower_Load","load")):
        if source in exposed:
            value=number(exposed[source])
            if value is not None and 0 <= value <= 1e9: city[target]=value
    if "Syndicate_City_Blackout" in exposed:
        b=bool_value(exposed["Syndicate_City_Blackout"])
        if b is not None: city["blackout"]=b
    telemetry={"source":"a2s_rules","s":{"city":city}} if city else None
    return exposed, telemetry

def collect(a2s, address=ADDRESS):
    """a2s is injected for unit tests; on production it is python-a2s."""
    timestamp=datetime.now(timezone.utc).isoformat()
    result={
        "checkedAt": timestamp, "address": f"{address[0]}:{address[1]}",
        "protocol":"Valve A2S / UDP", "infoOk":False, "rulesOk":False,
        "server": None, "queryError":None, "rulesError":None,
        "nppRules":{}, "nppTelemetry":None
    }
    try:
        info=a2s.info(address,timeout=5)
        result["server"]={
            "name":safe_text(getattr(info,"server_name",None)),
            "map":safe_text(getattr(info,"map_name",None)),
            "players":max(0,min(int(info.player_count),255)),
            "maxPlayers":max(0,min(int(info.max_players),255)),
        }
        result["infoOk"]=True
    except Exception as error:
        result["queryError"]=safe_text(type(error).__name__+": "+str(error),220)
        return result
    # A2S_RULES is a separate optional query. It does not expose Lua globals.
    try:
        rules=a2s.rules(address,timeout=5)
        result["rulesOk"]=True
        result["ruleCount"]=len(rules)
        result["nppRules"],result["nppTelemetry"]=extract_npp(rules)
    except Exception as error:
        result["rulesError"]=safe_text(type(error).__name__+": "+str(error),220)
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="site/data/source-query.json")
    args=parser.parse_args()
    import a2s
    result=collect(a2s)
    path=Path(args.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Info:",result["infoOk"],"Rules:",result["rulesOk"],
          "Published NPP rules:",len(result["nppRules"]),"saved:",path)
    # Network timeout is not a build error: publish a truthful unavailable status.

if __name__ == "__main__":main()
