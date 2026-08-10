# PizzaWarriors Upgrade Advisor

`/upgrade` reads the public [PizzaWarriors Lordaeron Best-in-Slot List](https://docs.google.com/spreadsheets/d/1i5CFTZ8kIrISQzvNmJHx85smAYlkaCTO9q_UcsrcqqE/edit?gid=1774197139#gid=1774197139) directly. It combines the character class from Warmane Armory with the specialization selected in Discord.

## Use it

```text
/upgrade name:Lausudo realm:Lordaeron spec:Protection
```

The specialization choices are drawn from the sheet's supported class paths, including variants such as Frost ArP and Frost Strength where the sheet distinguishes them.

## What members receive

The response uses the same PizzaWarriors card style as `/armory` and shows:

- the selected character, realm, and specialization;
- the current guide-target count and already-equipped matches;
- target slots with item, item-level, and GearScore information when supplied by the sheet;
- an Armory button and a direct button to the relevant class tab in the Best-in-Slot sheet.

## How it stays current

The bot fetches the public sheet as CSV and keeps it in memory for five minutes. Sheet updates therefore flow into `/upgrade` automatically without a bot redeploy. If an item cell contains alternatives separated by a slash or newline, each name is recognized as a valid target match.

## Officer curation

The spreadsheet is the source of truth. Update its class tab and path-specific columns when guild theorycrafting changes; the card will reflect the revised recommendations on the next refresh window. Keep item names close to their Armory spelling so ownership matching remains accurate.
