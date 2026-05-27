# GLUniverse PF2e Stat Block Importer

Markdown stat block importer for Foundry VTT v14 and the Pathfinder Second Edition system. Imports both NPCs and hazards, and accepts either the strict Markdown format or standard published (Archives of Nethys / Monster Core) stat blocks.

## Features

- Create new PF2e **NPC and hazard** actors from stat blocks.
- Accept both the strict Markdown format and **loose/published stat blocks** (auto-detected) — paste a creature or hazard straight from a published source.
- Update existing NPC or hazard actors with selectable merge modes.
- Preview parsed data before import, including a hazard summary.
- Validate traits, damage types, conditions, and Rule Element keys against the **installed PF2e system version** (no hardcoded drift).
- Match PF2e compendium spells and equipment with fuzzy, cross-type fallback matching.
- Auto-assign **token art and portrait** from a matching PF2e bestiary actor, plus size-linked token dimensions, disposition, and vision.
- Import attacks, actions, inventory, spellcasting entries, effects, and auras.
- Convert common text into PF2e inline checks, inline damage, and condition links.
- Pass through PF2e Rule Elements as JSON.
- Export existing NPC and hazard actors back to the Markdown format.
- Includes an LLM authoring reference at `docs/LLM_STATBLOCK_FORMAT.md`.

## Requirements

- Foundry VTT v14
- Pathfinder Second Edition system 8.0 or newer

## Installation

In Foundry's **Add-on Modules** setup screen, choose **Install Module** and paste this manifest URL:

```text
https://github.com/patcharapon-j/gluniverse-pf2e-statsblock-import/releases/latest/download/module.json
```

## Usage

1. Enable the module in a PF2e world.
2. Open the importer from **Configure Settings → Module Settings**, or right-click an NPC/hazard actor and choose **Import PF2e Stat Block**.
3. Paste a stat block — either the strict Markdown format or a standard published (Archives of Nethys / Monster Core) block.
4. Click **Parse Preview**.
5. Create a new actor or update a selected NPC/hazard actor.

The strict format and hazard/loose handling are documented in `docs/LLM_STATBLOCK_FORMAT.md`.

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
