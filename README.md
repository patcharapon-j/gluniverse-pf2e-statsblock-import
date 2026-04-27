# GLUniverse PF2e Stat Block Importer

Strict Markdown NPC stat block importer for Foundry VTT v13 and the Pathfinder Second Edition system.

## Features

- Create new PF2e NPC actors from strict Markdown stat blocks.
- Update existing NPC actors with selectable merge modes.
- Preview parsed NPC data before import.
- Validate traits, damage types, spells, attack effects, and Rule Elements.
- Match PF2e compendium spells and equipment when possible.
- Import NPC attacks, actions, inventory, spellcasting entries, effects, and auras.
- Convert common text into PF2e inline checks, inline damage, and condition links.
- Pass through PF2e Rule Elements as JSON.
- Export existing NPC actors back to the strict Markdown format.
- Includes an LLM authoring reference at `docs/LLM_STATBLOCK_FORMAT.md`.

## Requirements

- Foundry VTT v13
- Pathfinder Second Edition system 7.12 or newer

## Installation

In Foundry's **Add-on Modules** setup screen, choose **Install Module** and paste this manifest URL:

```text
https://github.com/patcharapon-j/gluniverse-pf2e-statsblock-import/releases/latest/download/module.json
```

## Usage

1. Enable the module in a PF2e world.
2. Open the Actor Directory.
3. Click **Import PF2e NPC**.
4. Paste a strict Markdown NPC stat block.
5. Click **Parse Preview**.
6. Create a new NPC or update a selected NPC actor.

The strict format is documented in `docs/LLM_STATBLOCK_FORMAT.md`.

## Update Modes

- **Replace matching imported items** replaces only imported items with matching type/name slugs.
- **Replace all imported items** deletes all items previously imported by this module and recreates them.
- **Append only new items** leaves existing imported items untouched and adds only new ones.
- **Update core stats only** updates actor stats but does not import items.
- **Update items only** imports items without changing actor stats.

The importer only deletes items it previously marked as imported. It does not delete unrelated actor items.

## Release Assets

- `module.json`: Foundry manifest file.
- `gluniverse-pf2e-statsblock-import.zip`: module archive.
