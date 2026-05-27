# GLUniverse PF2e Stat Block Import Format

This file describes the strict Markdown format expected by the GLUniverse PF2e Stat Block Importer for Foundry VTT v14 and the PF2e system.

Use this format when asking an LLM to produce an importable NPC or hazard. Prefer explicit structured fields over prose. The importer can link checks, damage, conditions, spell compendium entries, action costs, attacks, effects, auras, and PF2e Rule Elements when the data is written in the expected sections. The importer also validates slugs against the installed PF2e system (damage types, conditions, traits, and Rule Element keys), reports compendium matches, supports several update/merge modes, and can export existing NPC and hazard actors back to this format.

## NPC vs. Hazard

The importer builds an NPC by default. It builds a **hazard** actor instead when any of the following is true:

- A top-level `Type: hazard` (or `Kind: hazard`) field is present.
- The `Traits` line includes `hazard`.
- Any hazard-only field is present: `Stealth`, `Hardness`, `Disable`, `Routine`, or `Reset`.

Hazard-only fields:

- `Stealth: +X` — the hazard's Stealth modifier (and optional detail in parentheses).
- `Hardness: N`
- `Complexity: complex` or `simple` (defaults to simple).
- `Disable:` — how the hazard is disabled (DC checks are auto-linked).
- `Routine:` — the hazard's routine on its turn (complex hazards).
- `Reset:` — how the hazard resets.

Hazards may still use `## Attacks` and `## Actions` sections.

## Loose / Published Stat Blocks

You do not have to use this strict format. If the pasted text does **not** begin with a `# Heading`, the importer falls back to a "loose" reader that understands the standard published PF2e layout (Archives of Nethys / Monster Core text), e.g. lines like `Perception +13; darkvision`, `AC 22; Fort +15, Ref +12, Will +11`, `Melee [one-action] jaws +15 (magical, reach 10 feet), Damage 2d8+7 piercing`, and `Arcane Innate Spells DC 22; 2nd fireball; Cantrips (3rd) detect magic`. The loose reader works for both creatures and hazards. It is heuristic, so review the parsed preview before importing.

## Token & Art

On import the module sets a sensible prototype token: size-linked dimensions, hostile disposition (neutral for hazards), and enabled vision for creatures. If a same-named creature exists in a PF2e Actor compendium, its portrait and token art are reused automatically (unless you supply an explicit `Image:` path).

## Output Rules For LLMs

- Output only the Markdown stat block, unless the user asks for explanation.
- Use one `# NPC Name` heading.
- Use `##` sections exactly as shown below when possible.
- Use `###` headings for every attack, action, spellcasting entry, inventory item, effect, or aura.
- Use signed modifiers such as `+14` or `-1`.
- Use comma-separated lists for traits, skills, languages, and item traits.
- Use PF2e slugs when known, such as `off-guard`, `frightened`, `reach-10`, `magical`, `fire`.
- Keep homebrew automation explicit in `RuleElements` as JSON.
- Do not rely on prose for automation if a structured field exists.

## Minimal Skeleton

```md
# NPC Name
Level: 1
Rarity: common
Size: medium
Traits: humanoid
Perception: +7; Senses: low-light vision
Languages: Common
Skills: Acrobatics +7, Athletics +6
Abilities: STR +3, DEX +4, CON +2, INT +0, WIS +2, CHA +1
AC: 17
Fortitude: +7
Reflex: +9
Will: +5
HP: 22
Speed: 25 feet
Description: One or two sentences of description.

## Attacks
### Shortsword
Type: melee
Bonus: +9
Damage: 1d6+3 piercing
Traits: agile, finesse, versatile-s

## Actions
### Sudden Lunge
Type: action
Actions: 1
Traits: flourish, move
Description: The NPC Strides up to half Speed and makes a Shortsword Strike.
RuleElements: []
```

## Core Fields

Required fields:

- `# Name`
- `Level`
- `AC`
- `Fortitude`, `Reflex`, `Will`
- `HP`

Recommended fields:

- `Rarity`: `common`, `uncommon`, `rare`, or `unique`
- `Size`: `tiny`, `small`, `medium`, `large`, `huge`, or `gargantuan`
- `Traits`: comma-separated PF2e traits
- `Perception`: signed modifier, optionally followed by senses
- `Languages`: comma-separated list
- `Skills`: comma-separated `Skill +N` entries
- `Abilities`: `STR +N, DEX +N, CON +N, INT +N, WIS +N, CHA +N`
- `Immunities`, `Weaknesses`, `Resistances`
- `Speed`: first speed is base speed; additional comma-separated speeds become other speeds
- `Description`

Example:

```md
Immunities: fire, sleep
Weaknesses: cold 5, vitality 5
Resistances: physical 5, poison 10
Speed: 25 feet, fly 40 feet, swim 20 feet
```

## Attacks

Each attack becomes a PF2e `melee` NPC attack item. Use `Type: melee` or `Type: ranged`.

```md
## Attacks
### Jaws
Type: melee
Bonus: +15
Damage: 2d8+7 piercing
Traits: magical, reach-10
Effects: grabbed
Description: On a critical hit, the target is frightened 1.

### Spit Fire
Type: ranged
Bonus: +14
Range: 60 feet
Damage: 2d6+5 fire
Traits: magical, fire
```

Supported fields:

- `Type`: `melee` or `ranged`
- `Bonus`: attack modifier
- `Damage`: formula and damage type, such as `2d8+7 slashing`
- Multi-part damage: `2d8+7 piercing plus 1d6 fire`
- Damage categories: `1d6 precision piercing`, `1d6 persistent fire`, `3 splash fire`
- `Traits`: NPC attack traits
- `Effects`: attack effect slugs, such as `grabbed`, `knockdown`, `push-10`
- `Range`: ranged increment in feet
- `Area`: area attacks, such as `15-foot cone`
- `Description`
- `RuleElements`: JSON array or one JSON object per bullet line

## Actions

Each action becomes a PF2e `action` item.

```md
## Actions
### Breath Weapon
Type: action
Actions: 2
Category: offensive
Traits: arcane, evocation, fire
Description: The dragon breathes fire in a 30-foot cone. Creatures take 6d6 fire damage with a DC 24 Reflex save.
RuleElements: []

### Reactive Tail
Type: reaction
Category: defensive
Traits: attack
Description: Trigger A creature leaves a square in reach. Effect The dragon makes a Tail Strike.
```

Supported fields:

- `Type`: `action`, `reaction`, `free`, or `passive`
- `Actions`: `1`, `2`, or `3` for normal actions
- `Category`: `offensive`, `defensive`, or `interaction`
- `Traits`
- `Frequency`: simple text like `1 per day`
- `Description`
- `RuleElements`

The importer turns text like `DC 24 Reflex` into `@Check[type:reflex|dc:24|showDC:all]`, text like `6d6 fire damage` into PF2e `@Damage[...]`, and common condition names into PF2e condition UUID links.

## Spellcasting

Each `###` block becomes a PF2e spellcasting entry. Spell names are looked up in the PF2e spell compendium and embedded on the actor when found.

```md
## Spellcasting
### Arcane Innate Spells
Tradition: arcane
Type: innate
Ability: cha
DC: 24
Attack: +16
Description:
- Cantrips: detect magic, light, telekinetic projectile
- 3: fireball, haste
- 2: invisibility, resist energy
- 1: fear
```

Supported fields:

- `Tradition`: `arcane`, `divine`, `occult`, or `primal`
- `Type`: `innate`, `prepared`, `spontaneous`, `focus`, or `ritual`
- `Ability`: `str`, `dex`, `con`, `int`, `wis`, or `cha`
- `DC`: spell DC
- `Attack`: spell attack modifier
- Spell lines: `- Cantrips: spell one, spell two` or `- 3: spell one, spell two`
- Slot counts: `- 3 (2 slots): fireball, haste`
- At-will spells: `- At Will: invisibility`
- Constant spells: `- Constant: detect magic`
- Daily innate spells: `- 3/day: fireball`
- Signature spells: `- 2: invisibility (signature), resist energy`
- Optional `Slots`: `1: 2, 2: 3, 3: 2`

## Inventory

Each inventory block becomes a simple PF2e physical item. For fully official equipment automation, prefer exact PF2e compendium items and add them manually after import if needed.

```md
## Inventory
### Flaming Collar
Type: equipment
Level: 5
Quantity: 1
Source: pf2e.equipment-srd
Traits: invested, magical, fire
Description: The collar grants authority over lesser fire creatures.
RuleElements:
- {"key":"FlatModifier","selector":"intimidation","value":1,"type":"item"}
```

Supported `Type` values:

- `equipment`
- `weapon`
- `armor`
- `shield`
- `consumable`
- `backpack`
- `treasure`

Use exact item names to let the importer pull official PF2e compendium items. Use `Source` or `Compendium` to hint a specific pack, such as `pf2e.equipment-srd`.

## Effects And Auras

Effects become PF2e `effect` items and can host Rule Elements. A block with `Radius` or in the `## Auras` section is treated as an aura.

```md
## Effects
### Heat Shimmer Aura
Traits: aura, fire, visual
Radius: 10 feet
Duration: unlimited
Description: Creatures in the aura are concealed by shimmering heat.
RuleElements:
- {"key":"Aura","radius":10,"traits":["fire","visual"],"effects":[]}
```

Supported fields:

- `Traits`: PF2e effect traits
- `Radius`: aura radius in feet
- `Duration`: `unlimited`, `encounter`, or a duration like `1 round`
- `Badge`: numeric counter badge
- `Description`
- `RuleElements`

Use explicit JSON Rule Elements for advanced automation. The importer passes them through to PF2e without trying to infer custom behavior from prose.

## RuleElements Format

Use either a full JSON array:

```md
RuleElements: [{"key":"FlatModifier","selector":"perception","value":2,"type":"status"}]
```

Or one JSON object per bullet:

```md
RuleElements:
- {"key":"FlatModifier","selector":"perception","value":2,"type":"status"}
- {"key":"RollOption","domain":"all","option":"guardian-aura"}
```

Invalid JSON is ignored with a preview warning.

## RuleHelpers Format

`RuleHelpers` is a shorthand for common Rule Elements. The importer converts these lines into JSON Rule Elements.

```md
RuleHelpers:
- FlatModifier selector=perception value=2 type=status
- RollOption domain=all option=guardian-aura
- Aura radius=10 value=fire,visual
- Note selector=perception value=Smoke does not impair this creature.
- GrantItem uuid=Compendium.pf2e.feats-srd.Item.SomeUuid
```

Prefer explicit `RuleElements` JSON for complex automation. Use `RuleHelpers` for quick common cases or when using the importer UI helper.

## Import Update Modes

When updating an existing NPC, the importer supports:

- Replace matching imported items
- Replace all imported items
- Append only new items
- Update core stats only
- Update items only

The importer only deletes items it previously marked as imported. It does not delete unrelated actor items.

## Export

The importer can export a selected NPC actor back to this strict Markdown format. Exported Markdown is intended as a clean editing baseline and can be re-imported after changes.

## Complete Example

```md
# Ember Drake Warden
Level: 5
Rarity: uncommon
Size: medium
Traits: dragon, fire
Perception: +13; Senses: darkvision, smoke vision
Languages: Common, Draconic
Skills: Acrobatics +12, Athletics +14, Intimidation +13, Stealth +10
Abilities: STR +5, DEX +3, CON +4, INT +0, WIS +2, CHA +4
AC: 22
Fortitude: +15
Reflex: +12
Will: +11
HP: 78
Immunities: fire
Weaknesses: cold 5
Speed: 25 feet, fly 40 feet
Description: A disciplined drake trained to guard volcanic sanctums.

## Attacks
### Jaws
Type: melee
Bonus: +15
Damage: 2d8+7 piercing
Traits: magical, reach-10
Effects: grabbed
Description: On a critical hit, the target is frightened 1.

### Tail
Type: melee
Bonus: +13
Damage: 2d6+7 bludgeoning
Traits: agile, reach-10

## Actions
### Breath Weapon
Type: action
Actions: 2
Traits: arcane, evocation, fire
Description: The warden breathes fire in a 30-foot cone. Creatures in the area take 6d6 fire damage with a DC 22 Reflex save.
RuleElements: []

## Spellcasting
### Arcane Innate Spells
Tradition: arcane
Type: innate
Ability: cha
DC: 22
Attack: +14
Description:
- Cantrips: detect magic, light
- 2: obscuring mist
- 1: fear

## Inventory
### Warden Collar
Type: equipment
Level: 5
Traits: invested, magical
Description: The collar marks the drake as a bonded guardian.

## Effects
### Heat Shimmer Aura
Traits: aura, fire, visual
Radius: 10 feet
Description: Creatures in the aura are concealed by wavering heat.
RuleElements:
- {"key":"Aura","radius":10,"traits":["fire","visual"],"effects":[]}
```
