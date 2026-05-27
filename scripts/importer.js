const MODULE_ID = "gluniverse-pf2e-statsblock-import";
const IMPORT_FOLDER = "Imported NPCs";
const FLAG_SOURCE = "sourceMarkdown";
const FLAG_PARSED = "parsedData";
const IMPORT_MODES = {
  replaceMatching: "Replace matching imported items",
  replaceAll: "Replace all imported items",
  appendOnly: "Append only new items",
  coreOnly: "Update core stats only",
  itemsOnly: "Update items only"
};

const SIZE_MAP = {
  tiny: "tiny",
  sm: "sm",
  small: "sm",
  med: "med",
  medium: "med",
  lg: "lg",
  large: "lg",
  huge: "huge",
  grg: "grg",
  gargantuan: "grg"
};

const SAVE_MAP = {
  fort: "fortitude",
  fortitude: "fortitude",
  ref: "reflex",
  reflex: "reflex",
  will: "will"
};

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const DAMAGE_TYPES = ["acid", "bleed", "bludgeoning", "cold", "electricity", "fire", "force", "mental", "piercing", "poison", "precision", "slashing", "sonic", "spirit", "vitality", "void"];
const DAMAGE_CATEGORIES = ["persistent", "precision", "splash"];
const CONDITION_WORDS = ["blinded", "broken", "clumsy", "concealed", "confused", "controlled", "dazzled", "deafened", "doomed", "drained", "dying", "encumbered", "enfeebled", "fascinated", "fatigued", "fleeing", "frightened", "grabbed", "hidden", "immobilized", "invisible", "off-guard", "paralyzed", "persistent-damage", "petrified", "prone", "quickened", "restrained", "sickened", "slowed", "stunned", "stupefied", "unconscious", "undetected", "unfriendly", "unnoticed", "wounded"];

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "openImporter", {
    name: "PF2e Stat Block Importer",
    label: "Open Importer",
    hint: "Paste strict Markdown PF2e NPC stat blocks, preview parsed data, then create or update NPC actors.",
    icon: "fa-solid fa-file-import",
    type: PF2EStatBlockImporter,
    restricted: true
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "pf2e") {
    ui.notifications?.warn("GLUniverse PF2e Stat Block Importer requires the PF2e system.");
  }
  game.modules.get(MODULE_ID).api = {
    open: () => new PF2EStatBlockImporter().render({ force: true }),
    parse: parseStrictMarkdown,
    exportActor: exportActorToMarkdown
  };
});

Hooks.on("renderActorDirectory", (_app, html) => {
  if (!game.user?.isGM || game.system.id !== "pf2e") return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".gluni-actor-directory-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gluni-actor-directory-button";
  button.innerHTML = '<i class="fa-solid fa-file-import"></i> Import PF2e NPC';
  button.addEventListener("click", () => new PF2EStatBlockImporter().render({ force: true }));
  const footer = root.querySelector(".directory-footer") ?? root;
  footer.append(button);
});

class PF2EStatBlockImporter extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "gluniverse-pf2e-statblock-importer",
    classes: ["gluniverse-pf2e-importer"],
    tag: "section",
    window: {
      title: "PF2e Stat Block Importer",
      icon: "fa-solid fa-file-import",
      resizable: true
    },
    position: {
      width: 1000,
      height: 760
    }
  };

  #source = "";
  #parsed = null;
  #validation = null;
  #updateMode = "replaceMatching";

  async _renderHTML() {
    const element = document.createElement("div");
    element.className = "gluni-pf2e-importer";
    element.innerHTML = this.#renderAppHtml();
    return element;
  }

  _replaceHTML(result, element) {
    element.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    root.querySelector("textarea[name='source']")?.addEventListener("input", (event) => {
      this.#source = event.currentTarget.value;
    });
    root.querySelector("button[data-action='parse']")?.addEventListener("click", () => this.#parseAndRender());
    root.querySelector("button[data-action='sample']")?.addEventListener("click", () => {
      this.#source = sampleStatBlock();
      this.#parseAndRender();
    });
    root.querySelector("button[data-action='create']")?.addEventListener("click", () => this.#createActor());
    root.querySelector("button[data-action='update']")?.addEventListener("click", () => this.#updateActor());
    root.querySelector("button[data-action='export']")?.addEventListener("click", () => this.#exportSelectedActor());
    root.querySelector("button[data-action='insertRuleHelper']")?.addEventListener("click", () => this.#insertRuleHelper());
    root.querySelector("select[name='updateMode']")?.addEventListener("change", (event) => {
      this.#updateMode = event.currentTarget.value;
    });
  }

  #renderAppHtml() {
    const actors = game.actors.filter((actor) => actor.type === "npc").sort((a, b) => a.name.localeCompare(b.name));
    const actorOptions = actors.map((actor) => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`).join("");
    const modeOptions = Object.entries(IMPORT_MODES).map(([value, label]) => `<option value="${value}" ${this.#updateMode === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
    return `
      <header class="gluni-import-hero">
        <div>
          <p class="gluni-eyebrow">GLUniverse PF2e Tools</p>
          <h1>NPC Stat Block Importer</h1>
          <p>Paste strict Markdown, validate PF2e data, then create, update, or export NPC actors.</p>
        </div>
        <div class="gluni-hero-badges">
          <span>Foundry v14</span>
          <span>PF2e</span>
          <span>Markdown</span>
        </div>
      </header>
      <section class="gluni-import-column">
        <div class="gluni-panel gluni-source-panel">
          <div class="gluni-panel-heading">
            <div>
              <h2>Source Markdown</h2>
              <p>Use the strict stat block format for best automation.</p>
            </div>
          </div>
          <textarea name="source" spellcheck="false" placeholder="Paste strict Markdown stat block here">${escapeHtml(this.#source)}</textarea>
          <div class="gluni-import-actions">
            <button class="gluni-primary" type="button" data-action="parse"><i class="fa-solid fa-magnifying-glass-chart"></i> Parse Preview</button>
            <button type="button" data-action="sample"><i class="fa-solid fa-wand-magic-sparkles"></i> Load Sample</button>
          </div>
        </div>
        <div class="gluni-panel gluni-options-panel">
          <label><span>Update mode</span><select name="updateMode">${modeOptions}</select></label>
        </div>
        <div class="gluni-panel">
          <fieldset class="gluni-rule-helper">
            <legend>Rule Element Helper</legend>
            <select name="ruleHelperType">
              <option value="FlatModifier">FlatModifier</option>
              <option value="RollOption">RollOption</option>
              <option value="Aura">Aura</option>
              <option value="Note">Note</option>
              <option value="GrantItem">GrantItem</option>
            </select>
            <input type="text" name="ruleHelperSelector" placeholder="selector/domain/radius">
            <input type="text" name="ruleHelperValue" placeholder="value/option/uuid/text">
            <button type="button" data-action="insertRuleHelper">Insert RuleElement</button>
          </fieldset>
        </div>
        <div class="gluni-panel gluni-target-panel">
          <div class="gluni-target-row">
            <button class="gluni-primary" type="button" data-action="create" ${this.#parsed?.valid ? "" : "disabled"}><i class="fa-solid fa-plus"></i> Create NPC</button>
            <select name="targetActor">${actorOptions}</select>
            <button type="button" data-action="update" ${this.#parsed?.valid ? "" : "disabled"}><i class="fa-solid fa-pen-to-square"></i> Update Selected</button>
            <button type="button" data-action="export"><i class="fa-solid fa-file-export"></i> Export Selected</button>
          </div>
        </div>
        <p class="gluni-muted">Strict Markdown gives the importer enough structure to create PF2e NPC fields, melee attacks, action items, spellcasting entries, physical items, effects, auras, inline checks, inline damage, condition links, and explicit rule elements.</p>
      </section>
      <section class="gluni-preview-column">
        <div class="gluni-preview">${renderPreview(this.#parsed, this.#validation)}</div>
      </section>
    `;
  }

  async #parseAndRender() {
    this.#parsed = parseStrictMarkdown(this.#source);
    this.#validation = await validateParsed(this.#parsed);
    this.render({ force: true });
  }

  async #createActor() {
    if (!this.#requireParsed()) return;
    const folder = await getOrCreateFolder();
    const actorData = buildActorSource(this.#parsed.npc, this.#source);
    actorData.folder = folder?.id ?? null;
    const actor = await Actor.create(actorData, { renderSheet: false });
    await importItems(actor, this.#parsed.npc, { mode: "appendOnly" });
    await actor.sheet.render(true);
    ui.notifications.info(`Created NPC: ${actor.name}`);
  }

  async #updateActor() {
    if (!this.#requireParsed()) return;
    const actorId = this.element.querySelector("select[name='targetActor']")?.value;
    const actor = game.actors.get(actorId);
    if (!actor || actor.type !== "npc") {
      ui.notifications.warn("Select an existing NPC actor to update.");
      return;
    }
    if (this.#updateMode !== "itemsOnly") {
      const actorData = buildActorSource(this.#parsed.npc, this.#source);
      delete actorData.name;
      delete actorData.type;
      await actor.update(actorData);
    }
    if (this.#updateMode !== "coreOnly") await importItems(actor, this.#parsed.npc, { mode: this.#updateMode });
    await actor.sheet.render(true);
    ui.notifications.info(`Updated NPC: ${actor.name}`);
  }

  async #exportSelectedActor() {
    const actorId = this.element.querySelector("select[name='targetActor']")?.value;
    const actor = game.actors.get(actorId);
    if (!actor || actor.type !== "npc") {
      ui.notifications.warn("Select an existing NPC actor to export.");
      return;
    }
    this.#source = exportActorToMarkdown(actor);
    await this.#parseAndRender();
    ui.notifications.info(`Exported NPC: ${actor.name}`);
  }

  #insertRuleHelper() {
    const root = this.element;
    const textarea = root.querySelector("textarea[name='source']");
    if (!textarea) return;
    const type = root.querySelector("select[name='ruleHelperType']")?.value ?? "FlatModifier";
    const selector = root.querySelector("input[name='ruleHelperSelector']")?.value?.trim() ?? "";
    const value = root.querySelector("input[name='ruleHelperValue']")?.value?.trim() ?? "";
    const rule = buildRuleHelperObject(type, selector, value);
    const insert = `\nRuleElements:\n- ${JSON.stringify(rule)}\n`;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = `${textarea.value.slice(0, start)}${insert}${textarea.value.slice(end)}`;
    this.#source = textarea.value;
    textarea.focus();
  }

  #requireParsed() {
    if (!this.#parsed) {
      ui.notifications.warn("Parse the stat block first.");
      return false;
    }
    if (!this.#parsed.valid) {
      ui.notifications.error("Fix parser errors before importing.");
      return false;
    }
    return true;
  }
}

function parseStrictMarkdown(source) {
  const npc = createEmptyNpc();
  const warnings = [];
  const errors = [];
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  let section = "core";
  let block = null;
  let multilineKey = null;

  const finishBlock = () => {
    if (!block) return;
    normalizeBlock(block, npc, warnings);
    block = null;
    multilineKey = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);

    if (h1) {
      finishBlock();
      npc.name = h1[1].trim();
      continue;
    }

    if (h2) {
      finishBlock();
      section = slugify(h2[1]);
      continue;
    }

    if (h3) {
      finishBlock();
      block = { section, name: h3[1].trim(), fields: {}, description: [], rulesText: [], ruleHelpersText: [] };
      continue;
    }

    if (!line.trim()) {
      if (multilineKey && block) block[multilineKey].push("");
      continue;
    }

    const kv = parseKeyValue(line);
    if (block) {
      if (multilineKey && line.trim().match(/^[-*]\s+/)) {
        block[multilineKey].push(line.trim());
        continue;
      }
      if (kv) {
        const key = slugify(kv.key);
        if (["description", "effect", "text"].includes(key)) {
          multilineKey = "description";
          if (kv.value) block.description.push(kv.value);
        } else if (["ruleelements", "rules", "rule-elements"].includes(key)) {
          multilineKey = "rulesText";
          if (kv.value) block.rulesText.push(kv.value);
        } else if (["rulehelpers", "rule-helpers", "automationhelpers", "automation-helpers"].includes(key)) {
          multilineKey = "ruleHelpersText";
          if (kv.value) block.ruleHelpersText.push(kv.value);
        } else {
          multilineKey = null;
          block.fields[key] = kv.value;
        }
      } else if (multilineKey) {
        block[multilineKey].push(line.trim());
      }
      continue;
    }

    if (kv) parseTopLevelField(section, kv.key, kv.value, npc, warnings);
  }
  finishBlock();

  validateNpc(npc, errors, warnings);
  return { npc, warnings, errors, valid: errors.length === 0 };
}

function createEmptyNpc() {
  return {
    name: "",
    level: 1,
    rarity: "common",
    size: "med",
    traits: [],
    description: "",
    image: "systems/pf2e/icons/default-icons/npc.svg",
    perception: { mod: 0, details: "", senses: [] },
    languages: { value: [], details: "" },
    skills: {},
    abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, 0])),
    ac: { value: 10, details: "" },
    saves: { fortitude: 0, reflex: 0, will: 0 },
    hp: { value: 10, details: "" },
    speed: { value: 25, otherSpeeds: [], details: "" },
    immunities: [],
    weaknesses: [],
    resistances: [],
    attacks: [],
    actions: [],
    spellcasting: [],
    inventory: [],
    effects: [],
    notes: []
  };
}

function parseTopLevelField(section, key, value, npc, warnings) {
  const slug = slugify(key);
  const target = slugify(section);
  if (target === "abilities" && ABILITY_KEYS.includes(slug.slice(0, 3))) {
    npc.abilities[slug.slice(0, 3)] = parseSignedInt(value);
    return;
  }
  if (target === "skills") {
    parseSkills(value ? `${key}: ${value}` : key, npc);
    return;
  }
  if (["defense", "defenses"].includes(target)) {
    parseDefenseField(slug, value, npc);
    return;
  }
  switch (slug) {
    case "name": npc.name = value.trim(); break;
    case "level": npc.level = parseSignedInt(value); break;
    case "rarity": npc.rarity = slugify(value) || "common"; break;
    case "size": npc.size = SIZE_MAP[slugify(value)] ?? "med"; break;
    case "traits": npc.traits = splitList(value).map(slugify).filter(Boolean); break;
    case "description": npc.description = value.trim(); break;
    case "image": npc.image = value.trim() || npc.image; break;
    case "perception": parsePerception(value, npc); break;
    case "senses": npc.perception.senses = parseSenses(value); break;
    case "languages": parseLanguages(value, npc); break;
    case "skills": parseSkills(value, npc); break;
    case "abilities": parseAbilities(value, npc); break;
    case "str": case "strength": npc.abilities.str = parseSignedInt(value); break;
    case "dex": case "dexterity": npc.abilities.dex = parseSignedInt(value); break;
    case "con": case "constitution": npc.abilities.con = parseSignedInt(value); break;
    case "int": case "intelligence": npc.abilities.int = parseSignedInt(value); break;
    case "wis": case "wisdom": npc.abilities.wis = parseSignedInt(value); break;
    case "cha": case "charisma": npc.abilities.cha = parseSignedInt(value); break;
    case "ac": npc.ac = parseValueDetails(value); break;
    case "fort": case "fortitude": npc.saves.fortitude = parseSignedInt(value); break;
    case "ref": case "reflex": npc.saves.reflex = parseSignedInt(value); break;
    case "will": npc.saves.will = parseSignedInt(value); break;
    case "hp": npc.hp = parseValueDetails(value); break;
    case "speed": parseSpeed(value, npc); break;
    case "immunities": npc.immunities = parseIWR(value, false, warnings); break;
    case "weaknesses": npc.weaknesses = parseIWR(value, true, warnings); break;
    case "resistances": npc.resistances = parseIWR(value, true, warnings); break;
    case "note": case "notes": npc.notes.push(value.trim()); break;
    default:
      if (value.match(/\bAC\b|\bFort\b|\bHP\b/i)) parseCompoundStats(`${key}: ${value}`, npc);
      else warnings.push(`Ignored field "${key}" in section "${section}".`);
  }
}

function parseDefenseField(slug, value, npc) {
  if (slug === "ac") npc.ac = parseValueDetails(value);
  else if (slug === "hp") npc.hp = parseValueDetails(value);
  else if (SAVE_MAP[slug]) npc.saves[SAVE_MAP[slug]] = parseSignedInt(value);
  else parseCompoundStats(`${slug}: ${value}`, npc);
}

function normalizeBlock(block, npc, warnings) {
  const fields = block.fields;
  const description = block.description.join("\n").trim();
  const rules = [...parseRuleElements(block.rulesText, warnings), ...parseRuleHelpers(block.ruleHelpersText, warnings)];
  const section = block.section;
  if (["attacks", "strikes", "melee-attacks", "ranged-attacks"].includes(section)) {
    const attackType = fields.type || fields.kind || (section.includes("ranged") ? "ranged" : "melee");
    npc.attacks.push({
      name: block.name,
      type: slugify(attackType),
      bonus: parseSignedInt(fields.bonus || fields.attack || fields.modifier || "0"),
      damage: fields.damage || "",
      damageRolls: parseDamageRolls(fields.damage || "", warnings, block.name),
      traits: splitList(fields.traits).map(slugify).filter(Boolean),
      effects: splitList(fields.effects || fields.attackeffects).map(slugify).filter(Boolean),
      range: parseDistance(fields.range),
      area: parseArea(fields.area),
      action: slugify(fields.action || "strike"),
      description,
      rules
    });
    return;
  }
  if (["actions", "abilities", "reactions", "free-actions", "passives"].includes(section)) {
    npc.actions.push({
      name: block.name,
      actionType: normalizeActionType(fields.type || fields.actiontype || section),
      actions: parseActionCount(fields.actions || fields.cost || fields.glyph || "1"),
      category: slugify(fields.category || "offensive") || "offensive",
      traits: splitList(fields.traits).map(slugify).filter(Boolean),
      frequency: fields.frequency || "",
      description,
      rules
    });
    return;
  }
  if (["spells", "spellcasting"].includes(section)) {
    npc.spellcasting.push({
      name: block.name,
      tradition: slugify(fields.tradition || firstWord(block.name) || "arcane"),
      prepared: normalizePrepared(fields.type || fields.prepared || fields.kind || "innate"),
      ability: normalizeAbility(fields.ability || "cha"),
      dc: parseSignedInt(fields.dc || fields.spelldc || "0"),
      attack: parseSignedInt(fields.attack || fields.spellattack || "0"),
      slots: parseSlots(fields.slots || ""),
      spells: parseSpellLines(fields.spells, description),
      description,
      rules
    });
    return;
  }
  if (["inventory", "items", "gear"].includes(section)) {
    npc.inventory.push({
      name: block.name,
      type: normalizeInventoryType(fields.type || fields.category || "equipment"),
      quantity: Math.max(1, parseSignedInt(fields.quantity || "1")),
      level: Math.max(0, parseSignedInt(fields.level || "0")),
      source: fields.source || fields.compendium || "",
      traits: splitList(fields.traits).map(slugify).filter(Boolean),
      description,
      rules
    });
    return;
  }
  if (["effects", "auras", "effects-auras", "automation"].includes(section)) {
    const isAura = section.includes("aura") || fields.radius || fields.range;
    npc.effects.push({
      name: block.name,
      isAura,
      level: Math.max(1, parseSignedInt(fields.level || String(npc.level || 1))),
      duration: fields.duration || "unlimited",
      badge: parseBadge(fields.badge || fields.value),
      traits: splitList(fields.traits).map(slugify).filter(Boolean),
      radius: parseDistance(fields.radius || fields.range),
      description,
      rules: isAura && !rules.some((rule) => rule.key === "Aura") ? [buildAuraRule(fields, block.name), ...rules].filter(Boolean) : rules
    });
    return;
  }
  warnings.push(`Ignored block "${block.name}" in section "${section}".`);
}

function validateNpc(npc, errors, warnings) {
  if (!npc.name) errors.push("Missing NPC name. Use '# NPC Name' or 'Name: NPC Name'.");
  if (!Number.isInteger(npc.level)) errors.push("Missing or invalid Level.");
  if (!npc.ac.value) warnings.push("AC was not detected; defaulting to 10.");
  if (!npc.hp.value) warnings.push("HP was not detected; defaulting to 10.");
  if (!npc.attacks.length && !npc.actions.length && !npc.spellcasting.length) warnings.push("No attacks, actions, or spells detected.");
}

function buildActorSource(npc, source) {
  const publicNotes = [npc.description, ...npc.notes].filter(Boolean).map((p) => `<p>${autoLinkText(escapeHtml(p))}</p>`).join("\n");
  return {
    name: npc.name,
    type: "npc",
    img: npc.image,
    system: {
      traits: {
        value: npc.traits,
        rarity: npc.rarity,
        size: { value: npc.size }
      },
      abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { mod: npc.abilities[key] ?? 0 }])),
      attributes: {
        ac: { value: npc.ac.value, details: npc.ac.details },
        hp: { value: npc.hp.value, max: npc.hp.value, details: npc.hp.details },
        speed: npc.speed,
        immunities: npc.immunities,
        weaknesses: npc.weaknesses,
        resistances: npc.resistances
      },
      perception: {
        mod: npc.perception.mod,
        details: npc.perception.details,
        senses: npc.perception.senses,
        vision: true
      },
      saves: {
        fortitude: { value: npc.saves.fortitude, saveDetail: "" },
        reflex: { value: npc.saves.reflex, saveDetail: "" },
        will: { value: npc.saves.will, saveDetail: "" }
      },
      skills: buildSkills(npc.skills),
      details: {
        level: { value: npc.level },
        languages: npc.languages,
        publicNotes,
        privateNotes: `<section><h3>Imported Source</h3><pre>${escapeHtml(source)}</pre></section>`
      }
    },
    flags: {
      [MODULE_ID]: {
        [FLAG_SOURCE]: source,
        [FLAG_PARSED]: npc
      }
    }
  };
}

async function importItems(actor, npc, { mode = "replaceMatching" } = {}) {
  const sources = [];
  sources.push(...npc.attacks.map(buildMeleeItem));
  sources.push(...npc.actions.map(buildActionItem));
  sources.push(...(await Promise.all(npc.inventory.map(buildInventoryItem))));
  sources.push(...npc.effects.map(buildEffectItem));

  const spellEntrySources = npc.spellcasting.map(buildSpellcastingEntryItem);
  const sourceKeys = new Set([...sources, ...spellEntrySources].map(itemKey));
  const imported = actor.items.filter((item) => item.getFlag(MODULE_ID, "imported"));

  if (mode === "replaceAll") {
    const ids = imported.map((item) => item.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  } else if (mode === "replaceMatching") {
    const matching = imported.filter((item) => sourceKeys.has(itemKey(item)));
    const matchingEntryIds = new Set(matching.filter((item) => item.type === "spellcastingEntry").map((item) => item.id));
    const childSpells = imported.filter((item) => item.type === "spell" && matchingEntryIds.has(item.system.location?.value));
    const ids = [...matching, ...childSpells].map((item) => item.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  }

  const existingKeys = new Set(actor.items.filter((item) => item.getFlag(MODULE_ID, "imported")).map(itemKey));
  const filteredSources = mode === "appendOnly" ? sources.filter((source) => !existingKeys.has(itemKey(source))) : sources;
  if (filteredSources.length) await actor.createEmbeddedDocuments("Item", filteredSources);
  await importSpellcasting(actor, npc.spellcasting, { mode });
}

function buildMeleeItem(attack) {
  const system = {
    description: { value: htmlDescription(attack.description), gm: "" },
    rules: attack.rules,
    slug: slugify(attack.name),
    traits: { value: attack.traits, otherTags: [] },
    action: attack.action || "strike",
    bonus: { value: attack.bonus },
    attackEffects: { value: attack.effects },
    damageRolls: attack.damageRolls,
    range: attack.type === "ranged" ? { increment: attack.range || 30, max: null } : null,
    area: attack.area,
    subjectToMAP: true
  };
  return importedItem({ name: attack.name, type: "melee", img: attack.type === "ranged" ? "systems/pf2e/icons/default-icons/ranged.svg" : "systems/pf2e/icons/default-icons/melee.svg", system });
}

function buildActionItem(action) {
  const system = {
    description: { value: htmlDescription(action.description), gm: "" },
    rules: action.rules,
    slug: slugify(action.name),
    traits: { value: action.traits, otherTags: [] },
    actionType: { value: action.actionType },
    actions: { value: action.actionType === "action" ? action.actions : null },
    category: action.category || "offensive"
  };
  if (action.frequency) system.frequency = parseFrequency(action.frequency);
  return importedItem({ name: action.name, type: "action", img: actionIcon(action.actionType, action.actions), system });
}

async function buildInventoryItem(item) {
  const matched = item.source ? await itemSourceFromCompendiums(item.name, { type: item.type, packHint: item.source }) : await itemSourceFromCompendiums(item.name, { type: item.type });
  const fallback = {
    name: item.name,
    type: item.type,
    img: `systems/pf2e/icons/default-icons/${item.type}.svg`,
    system: {
      description: { value: htmlDescription(item.description), gm: "" },
      rules: item.rules,
      slug: slugify(item.name),
      level: { value: item.level },
      quantity: item.quantity,
      traits: { value: item.traits, rarity: "common", otherTags: [] }
    }
  };
  const source = matched ?? fallback;
  delete source._id;
  source.name = item.name;
  source.system ??= {};
  source.system.quantity = item.quantity;
  source.system.rules = item.rules.length ? item.rules : (source.system.rules ?? []);
  if (item.description) source.system.description = { value: htmlDescription(item.description), gm: source.system.description?.gm ?? "" };
  return importedItem(source);
}

function buildEffectItem(effect) {
  return importedItem({
    name: effect.name,
    type: "effect",
    img: "systems/pf2e/icons/default-icons/effect.svg",
    system: {
      description: { value: htmlDescription(effect.description), gm: "" },
      rules: effect.rules,
      slug: slugify(effect.name),
      level: { value: effect.level },
      traits: { value: effect.traits, otherTags: [] },
      duration: parseDuration(effect.duration),
      badge: effect.badge,
      tokenIcon: { show: true },
      unidentified: false,
      start: { value: 0, initiative: null },
      fromSpell: false
    }
  });
}

function importedItem(source) {
  return foundry.utils.mergeObject(source, { flags: { [MODULE_ID]: { imported: true } } }, { inplace: false });
}

function buildSpellcastingEntryItem(entry) {
  return importedItem({
    name: entry.name,
    type: "spellcastingEntry",
    img: "systems/pf2e/icons/default-icons/spellcastingEntry.svg",
    system: {
      description: { value: htmlDescription(entry.description), gm: "" },
      rules: entry.rules,
      slug: slugify(entry.name),
      ability: { value: entry.ability },
      tradition: { value: entry.tradition },
      prepared: { value: entry.prepared },
      spelldc: { value: entry.attack, dc: entry.dc },
      showSlotlessLevels: { value: true },
      proficiency: { value: 1 },
      slots: buildSpellSlots(entry)
    }
  });
}

async function importSpellcasting(actor, entries, { mode = "replaceMatching" } = {}) {
  const existingKeys = new Set(actor.items.filter((item) => item.getFlag(MODULE_ID, "imported")).map(itemKey));
  for (const entry of entries) {
    const entrySource = buildSpellcastingEntryItem(entry);
    if (mode === "appendOnly" && existingKeys.has(itemKey(entrySource))) continue;
    const [createdEntry] = await actor.createEmbeddedDocuments("Item", [entrySource]);
    const spellSources = [];
    for (const spell of entry.spells) {
      const source = await spellSourceFromCompendium(spell.name);
      if (!source) continue;
      delete source._id;
      source.system.location = buildSpellLocation(spell, createdEntry.id);
      if (Number.isInteger(spell.level)) source.system.level = { value: spell.level };
      source.flags ??= {};
      source.flags[MODULE_ID] = { imported: true, originalName: spell.name, frequency: spell.frequency };
      spellSources.push(source);
    }
    if (spellSources.length) await actor.createEmbeddedDocuments("Item", spellSources);
  }
}

async function spellSourceFromCompendium(name) {
  const match = await findCompendiumItem(name, { type: "spell", packHint: "pf2e.spells-srd" });
  if (!match) {
    ui.notifications.warn(`Spell not found in PF2e compendium: ${name}`);
    return null;
  }
  const document = await match.pack.getDocument(match.entry._id);
  return document.toObject();
}

async function itemSourceFromCompendiums(name, options = {}) {
  const match = await findCompendiumItem(name, options);
  if (!match) return null;
  const document = await match.pack.getDocument(match.entry._id);
  return document.toObject();
}

async function findCompendiumItem(name, { type = null, packHint = "" } = {}) {
  if (!globalThis.game?.packs) return null;
  const normalizedName = normalizeName(name);
  const packs = game.packs.filter((pack) => pack.documentName === "Item" && (!packHint || pack.collection === packHint || pack.metadata?.id === packHint || pack.collection.includes(packHint)));
  const searchPacks = packs.length ? packs : game.packs.filter((pack) => pack.documentName === "Item" && pack.metadata?.packageName === "pf2e");
  for (const pack of searchPacks) {
    const index = await pack.getIndex({ fields: ["name", "type", "system.slug"] });
    const entry = index.find((candidate) => (!type || candidate.type === type) && (normalizeName(candidate.name) === normalizedName || slugify(candidate.system?.slug) === slugify(name)));
    if (entry) return { pack, entry };
  }
  return null;
}

function itemKey(item) {
  return `${item.type}:${slugify(item.system?.slug ?? item.slug ?? item.name)}`;
}

function buildSpellSlots(entry) {
  const slots = Object.fromEntries(Array.from({ length: 12 }, (_value, rank) => [`slot${rank}`, { prepared: [], value: 0, max: 0 }]));
  for (const spell of entry.spells) {
    if (!Number.isInteger(spell.level)) continue;
    const rank = Math.min(11, Math.max(0, Number(spell.level) || 0));
    const slot = slots[`slot${rank}`];
    const count = spell.slots ?? entry.slots[rank] ?? (entry.prepared === "prepared" ? 1 : 0);
    slot.max = Math.max(slot.max, count);
    slot.value = Math.max(slot.value, count);
  }
  for (const [rank, count] of Object.entries(entry.slots)) {
    const slot = slots[`slot${rank}`];
    if (!slot) continue;
    slot.max = Math.max(slot.max, count);
    slot.value = Math.max(slot.value, count);
  }
  return slots;
}

function buildSpellLocation(spell, entryId) {
  const location = { value: entryId };
  if (spell.signature) location.signature = true;
  if (spell.heightened) location.heightenedLevel = spell.heightened;
  if (spell.frequency === "at-will" || spell.frequency === "constant") location.uses = { value: -1, max: -1, per: "day" };
  else if (spell.uses) location.uses = { value: spell.uses, max: spell.uses, per: spell.per ?? "day" };
  return location;
}

function renderPreview(parsed, validation = null) {
  if (!parsed) return `<div class="gluni-empty-preview"><i class="fa-solid fa-scroll"></i><h2>No preview yet</h2><p>Paste a strict Markdown stat block and click <strong>Parse Preview</strong>.</p></div>`;
  const { npc, warnings, errors } = parsed;
  const chips = (values) => `<span class="gluni-chip-list">${values.map((v) => `<span class="gluni-chip">${escapeHtml(v)}</span>`).join("")}</span>`;
  return `
    <div class="gluni-preview-title">
      <p class="gluni-eyebrow">Parsed Preview</p>
      <h2>${escapeHtml(npc.name || "Unnamed NPC")}</h2>
    </div>
    ${errors.map((error) => `<p class="gluni-notice gluni-error">${escapeHtml(error)}</p>`).join("")}
    ${warnings.map((warning) => `<p class="gluni-notice gluni-warning">${escapeHtml(warning)}</p>`).join("")}
    <table class="gluni-stat-table">
      <tr><th>Level</th><td>${npc.level}</td><th>Rarity</th><td>${escapeHtml(npc.rarity)}</td></tr>
      <tr><th>Size</th><td>${escapeHtml(npc.size)}</td><th>Traits</th><td>${chips(npc.traits)}</td></tr>
      <tr><th>Perception</th><td>${signed(npc.perception.mod)}</td><th>Languages</th><td>${chips(npc.languages.value)}</td></tr>
      <tr><th>AC</th><td>${npc.ac.value}</td><th>HP</th><td>${npc.hp.value}</td></tr>
      <tr><th>Fort</th><td>${signed(npc.saves.fortitude)}</td><th>Ref</th><td>${signed(npc.saves.reflex)}</td></tr>
      <tr><th>Will</th><td>${signed(npc.saves.will)}</td><th>Speed</th><td>${npc.speed.value} ft.</td></tr>
    </table>
    <div class="gluni-preview-card">
      <h3>Abilities</h3>
      <p class="gluni-ability-row">${ABILITY_KEYS.map((key) => `<span><strong>${key.toUpperCase()}</strong> ${signed(npc.abilities[key])}</span>`).join("")}</p>
    </div>
    <div class="gluni-preview-card">
      <h3>Skills</h3>
      <p>${Object.entries(npc.skills).map(([key, value]) => `${escapeHtml(key)} ${signed(value)}`).join(", ") || "None"}</p>
    </div>
    <h3>Automation Items</h3>
    <table class="gluni-stat-table gluni-automation-table">
      <tr><th>Attacks</th><td>${npc.attacks.length}</td><th>Actions</th><td>${npc.actions.length}</td></tr>
      <tr><th>Spellcasting</th><td>${npc.spellcasting.length}</td><th>Inventory</th><td>${npc.inventory.length}</td></tr>
      <tr><th>Effects/Auras</th><td>${npc.effects.length}</td><th>Rule Elements</th><td>${countRules(npc)}</td></tr>
    </table>
    ${renderValidation(validation)}
    ${renderNamedList("Attacks", npc.attacks)}
    ${renderNamedList("Actions", npc.actions)}
    ${renderNamedList("Spellcasting", npc.spellcasting)}
    ${renderNamedList("Effects", npc.effects)}
  `;
}

function renderValidation(validation) {
  if (!validation) return `<div class="gluni-preview-card"><h3>Validation</h3><p class="gluni-muted">Validation runs after parsing.</p></div>`;
  const list = (title, values, className = "") => values.length ? `<h4>${title}</h4><ul class="gluni-validation-list ${className}">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : "";
  return `
    <div class="gluni-preview-card gluni-validation-card">
    <h3>Validation</h3>
    ${list("Errors", validation.errors, "gluni-error")}
    ${list("Warnings", validation.warnings, "gluni-warning")}
    ${list("Compendium Matches", validation.matches)}
    ${!validation.errors.length && !validation.warnings.length ? `<p class="gluni-muted">No validation issues detected.</p>` : ""}
    </div>
  `;
}

function renderNamedList(title, values) {
  if (!values.length) return "";
  return `<div class="gluni-preview-card"><h3>${title}</h3><ul class="gluni-named-list">${values.map((value) => `<li><strong>${escapeHtml(value.name)}</strong>${value.traits?.length ? `<span>${escapeHtml(value.traits.join(", "))}</span>` : ""}</li>`).join("")}</ul></div>`;
}

function countRules(npc) {
  return [...npc.attacks, ...npc.actions, ...npc.spellcasting, ...npc.inventory, ...npc.effects].reduce((total, item) => total + (item.rules?.length ?? 0), 0);
}

async function validateParsed(parsed) {
  const result = { errors: [], warnings: [], matches: [] };
  if (!parsed?.npc) return result;
  const { npc } = parsed;
  const traitSet = pf2eTraitSet();
  const damageTypes = new Set(Object.keys(globalThis.CONFIG?.PF2E?.damageTypes ?? {}).concat(DAMAGE_TYPES));
  const ruleKeys = new Set(["AdjustModifier", "AdjustStrike", "Aura", "ChoiceSet", "FlatModifier", "GrantItem", "Note", "Resistance", "RollOption", "Weakness"]);

  for (const trait of collectTraits(npc)) {
    if (traitSet.size && !traitSet.has(trait)) result.warnings.push(`Unknown PF2e trait slug: ${trait}`);
  }
  for (const attack of npc.attacks) {
    for (const roll of Object.values(attack.damageRolls)) {
      if (!damageTypes.has(roll.damageType)) result.warnings.push(`Unknown damage type on ${attack.name}: ${roll.damageType}`);
    }
    for (const effect of attack.effects) {
      if (!isKnownAttackEffect(effect)) result.warnings.push(`Attack effect may not resolve automatically: ${effect}`);
    }
  }
  for (const rule of collectRules(npc)) {
    if (!rule?.key) result.errors.push("Rule Element is missing a key.");
    else if (!ruleKeys.has(rule.key)) result.warnings.push(`Rule Element key is not in the helper validation list: ${rule.key}`);
  }
  for (const entry of npc.spellcasting) {
    for (const spell of entry.spells) {
      const match = await findCompendiumItem(spell.name, { type: "spell", packHint: "pf2e.spells-srd" });
      if (match) result.matches.push(`Spell: ${spell.name} -> ${match.pack.collection}`);
      else result.warnings.push(`Spell not found in PF2e spell compendium: ${spell.name}`);
    }
  }
  for (const item of npc.inventory) {
    const match = await findCompendiumItem(item.name, { type: item.type, packHint: item.source });
    if (match) result.matches.push(`Item: ${item.name} -> ${match.pack.collection}`);
    else result.warnings.push(`Inventory item will be created as generic ${item.type}: ${item.name}`);
  }
  return result;
}

function collectTraits(npc) {
  return [...npc.traits, ...npc.attacks.flatMap((item) => item.traits), ...npc.actions.flatMap((item) => item.traits), ...npc.inventory.flatMap((item) => item.traits), ...npc.effects.flatMap((item) => item.traits)];
}

function collectRules(npc) {
  return [...npc.attacks, ...npc.actions, ...npc.spellcasting, ...npc.inventory, ...npc.effects].flatMap((item) => item.rules ?? []);
}

function pf2eTraitSet() {
  const pf2e = globalThis.CONFIG?.PF2E ?? {};
  const keys = Object.keys(pf2e).filter((key) => key.toLowerCase().includes("trait"));
  return new Set(keys.flatMap((key) => Object.keys(pf2e[key] ?? {})).map(slugify));
}

function isKnownAttackEffect(effect) {
  const config = globalThis.CONFIG?.PF2E?.attackEffects ?? {};
  return !Object.keys(config).length || effect in config || CONDITION_WORDS.includes(effect);
}

function parseKeyValue(line) {
  const match = line.match(/^[-*]?\s*([A-Za-z][A-Za-z0-9 /_-]*):\s*(.*)$/);
  return match ? { key: match[1].trim(), value: match[2].trim() } : null;
}

function parseCompoundStats(text, npc) {
  for (const part of text.split(/;|,/)) {
    const kv = parseKeyValue(part.trim());
    if (kv) parseTopLevelField("defense", kv.key, kv.value, npc, []);
  }
}

function parsePerception(value, npc) {
  npc.perception.mod = parseSignedInt(value);
  const sensesMatch = value.match(/senses?:\s*(.+)$/i);
  if (sensesMatch) npc.perception.senses = parseSenses(sensesMatch[1]);
  npc.perception.details = value.replace(/^[-+]?\d+\s*;?\s*/i, "").trim();
}

function parseSenses(value) {
  return splitList(value).map((sense) => {
    const match = sense.match(/^(.+?)\s+(\d+)\s*(?:feet|ft\.?)/i);
    return match ? { type: slugify(match[1]), acuity: "imprecise", range: Number(match[2]) } : { type: slugify(sense), acuity: "precise", range: null };
  });
}

function parseLanguages(value, npc) {
  const parts = splitList(value);
  npc.languages.value = parts.map(slugify).filter(Boolean);
  npc.languages.details = value;
}

function parseSkills(value, npc) {
  const text = value.replace(/^skills?:\s*/i, "");
  for (const part of text.split(/,|;/)) {
    const match = part.trim().match(/^(.+?)\s*:?\s*([-+]\d+)$/);
    if (match) npc.skills[slugify(match[1])] = Number(match[2]);
  }
}

function parseAbilities(value, npc) {
  for (const part of value.split(/,|;/)) {
    const match = part.trim().match(/^(str|dex|con|int|wis|cha)\s*:?\s*([-+]\d+)$/i);
    if (match) npc.abilities[match[1].toLowerCase()] = Number(match[2]);
  }
}

function parseValueDetails(value) {
  const number = parseSignedInt(value);
  return { value: number, details: value.replace(/^[-+]?\d+\s*;?\s*/i, "").trim() };
}

function parseSpeed(value, npc) {
  const parts = splitList(value);
  const main = parts.shift() ?? value;
  npc.speed.value = parseDistance(main) || 25;
  npc.speed.details = value;
  npc.speed.otherSpeeds = parts.map((part) => ({ type: slugify(part.replace(/\d+.*/, "").trim()), value: parseDistance(part) || 0 })).filter((speed) => speed.type && speed.value);
}

function parseIWR(value, withValue, warnings) {
  return splitList(value).map((part) => {
    const match = part.match(/^(.+?)\s+(\d+)$/);
    const type = slugify(match ? match[1] : part);
    if (!type) return null;
    if (withValue && !match) warnings.push(`IWR entry "${part}" has no value.`);
    return withValue ? { type, value: Number(match?.[2] ?? 1), exceptions: [] } : { type, exceptions: [] };
  }).filter(Boolean);
}

function parseRuleElements(lines, warnings) {
  const text = lines.join("\n").trim();
  if (!text || text.toLowerCase() === "none") return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_error) {
    const rules = [];
    for (const line of lines) {
      const trimmed = line.replace(/^[-*]\s*/, "").trim();
      if (!trimmed) continue;
      try {
        rules.push(JSON.parse(trimmed));
      } catch (_err) {
        warnings.push(`RuleElements must be JSON objects or arrays; ignored: ${trimmed}`);
      }
    }
    return rules;
  }
}

function parseRuleHelpers(lines, warnings) {
  const rules = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*]\s*/, "").trim();
    if (!line) continue;
    const [, type, text = ""] = line.match(/^(\S+)\s*(.*)$/) ?? [];
    const values = parseHelperValues(text);
    const selector = values.selector ?? values.domain ?? values.radius ?? "";
    const value = values.value ?? values.option ?? values.uuid ?? values.text ?? "";
    const rule = buildRuleHelperObject(type, selector, value, values);
    if (rule.key) rules.push(rule);
    else warnings.push(`Unknown RuleHelper type ignored: ${type}`);
  }
  return rules;
}

function parseHelperValues(text) {
  const matches = [...String(text).matchAll(/([A-Za-z][A-Za-z0-9_-]*)=/g)];
  const values = {};
  for (let index = 0; index < matches.length; index += 1) {
    const key = slugify(matches[index][1]);
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? text.length;
    values[key] = text.slice(start, end).trim().replace(/^"|"$/g, "");
  }
  return values;
}

function buildRuleHelperObject(type, selector, value, extra = {}) {
  const key = String(type ?? "").trim();
  if (key === "FlatModifier") return { key, selector: selector || "all", value: Number(value) || 0, type: extra.type ?? "untyped" };
  if (key === "RollOption") return { key, domain: selector || "all", option: value || "option" };
  if (key === "Aura") return { key, radius: Number(selector) || 5, traits: splitList(value).map(slugify).filter(Boolean), effects: [] };
  if (key === "Note") return { key, selector: selector || "all", text: value || "" };
  if (key === "GrantItem") return { key, uuid: value || selector || "" };
  return { key };
}

function buildAuraRule(fields, name) {
  const radius = parseDistance(fields.radius || fields.range);
  if (!radius) return null;
  return {
    key: "Aura",
    slug: slugify(name),
    radius,
    traits: splitList(fields.traits).map(slugify).filter((trait) => trait !== "aura"),
    effects: []
  };
}

function parseSpellLines(fieldValue, description) {
  const text = [fieldValue, description].filter(Boolean).join("\n");
  const spells = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^[-*]\s*/, "").trim();
    const match = line.match(/^(constant|at[- ]?will|cantrips?|\d+\s*\/\s*day|\d+)(?:st|nd|rd|th)?(?:\s*\((\d+)\s*slots?\))?\s*:?\s*(.+)$/i);
    if (!match) continue;
    const label = match[1].toLowerCase().replace(/\s+/g, "");
    const level = label.startsWith("cantrip") ? 0 : (label === "at-will" || label === "atwill" || label === "constant" || label.includes("/day") ? null : Number(label));
    const frequency = label === "constant" ? "constant" : (label === "at-will" || label === "atwill" ? "at-will" : (label.includes("/day") ? "daily" : "slot"));
    const uses = label.includes("/day") ? Number(label.match(/\d+/)?.[0] ?? 1) : null;
    const slots = match[2] ? Number(match[2]) : null;
    for (const rawName of splitList(match[3])) spells.push(parseSpellName(rawName, { level, frequency, uses, slots }));
  }
  return spells;
}

function parseSpellName(value, defaults) {
  const metadata = [...String(value).matchAll(/\(([^)]+)\)/g)].map((match) => match[1].toLowerCase());
  const name = String(value).replace(/\s*\([^)]+\)/g, "").trim();
  const heightened = Number(metadata.find((part) => part.includes("heightened"))?.match(/\d+/)?.[0] ?? 0) || null;
  return {
    ...defaults,
    name,
    signature: metadata.some((part) => part.includes("signature")),
    heightened
  };
}

function parseSlots(value) {
  const slots = {};
  for (const part of splitList(value)) {
    const match = part.match(/(\d+)\s*(?::|=|-)\s*(\d+)/);
    if (match) slots[Number(match[1])] = Number(match[2]);
  }
  return slots;
}

function buildSkills(skills) {
  const configSkills = CONFIG.PF2E?.skills ?? {};
  const result = {};
  for (const [name, value] of Object.entries(skills)) {
    const slug = skillSlug(name, configSkills);
    if (slug in configSkills) result[slug] = { base: value };
    else result[name] = { base: value };
  }
  return result;
}

function skillSlug(name, configSkills) {
  const slug = slugify(name);
  if (slug in configSkills) return slug;
  const normalized = slug.replace(/-/g, "");
  return Object.keys(configSkills).find((key) => slugify(game.i18n.localize(configSkills[key].label)) === slug || key === normalized) ?? slug;
}

function htmlDescription(text) {
  if (!text) return "";
  return text.split(/\n{2,}/).map((paragraph) => `<p>${autoLinkText(escapeHtml(paragraph.trim()).replace(/\n/g, "<br>"))}</p>`).join("\n");
}

function autoLinkText(text) {
  let enriched = text;
  enriched = enriched.replace(/\b(DC)\s+(\d+)\s+(Fortitude|Fort|Reflex|Ref|Will)\b/gi, (_match, _dc, dc, save) => `@Check[type:${SAVE_MAP[slugify(save)]}|dc:${dc}|showDC:all]`);
  enriched = enriched.replace(/\b(Fortitude|Fort|Reflex|Ref|Will)\s+DC\s+(\d+)\b/gi, (_match, save, dc) => `@Check[type:${SAVE_MAP[slugify(save)]}|dc:${dc}|showDC:all]`);
  enriched = enriched.replace(/\b(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s+(${DAMAGE_TYPES.join("|")})\s+damage\b/gi, (_match, formula, type) => `@Damage[(${formula.replace(/\s+/g, "")})[${slugify(type)}]]{${formula} ${type} damage}`);
  for (const condition of CONDITION_WORDS) {
    const label = titleCase(condition.replace(/-/g, " "));
    const uuid = conditionUuid(condition);
    const pattern = new RegExp(`\\b${condition.replace(/-/g, "[- ]")}\\b`, "gi");
    enriched = enriched.replace(pattern, (match, offset, full) => {
      if (full.slice(Math.max(0, offset - 12), offset).includes("@UUID[")) return match;
      return `@UUID[${uuid}]{${label}}`;
    });
  }
  return enriched;
}

function conditionUuid(slug) {
  try {
    const manager = game.pf2e?.ConditionManager;
    if (manager?.conditionsSlugs?.includes(slug)) {
      const condition = manager.getCondition(slug);
      return condition?._stats?.compendiumSource ?? condition?.uuid ?? `Compendium.pf2e.conditionitems.Item.${slug}`;
    }
  } catch (_error) {
    return `Compendium.pf2e.conditionitems.Item.${slug}`;
  }
  return `Compendium.pf2e.conditionitems.Item.${slug}`;
}

function parseDamageRolls(value, warnings = [], attackName = "attack") {
  const text = String(value ?? "").replace(/\bplus\b/gi, ",");
  const rolls = {};
  let index = 0;
  for (const part of text.split(/,|;/).map((piece) => piece.trim()).filter(Boolean)) {
    const match = part.match(/(\d+d\d+(?:\s*[+\-]\s*\d+)?|\d+)\s+(?:(persistent|precision|splash|critical-only|crit-only)\s+)?([a-z -]+?)(?:\s+damage)?$/i);
    if (!match) {
      warnings.push(`Could not parse damage part "${part}" on ${attackName}.`);
      continue;
    }
    const formula = match[1].replace(/\s+/g, "");
    const categorySlug = slugify(match[2] ?? "");
    const typeSlug = slugify(match[3]);
    const damageType = DAMAGE_TYPES.includes(typeSlug) ? typeSlug : "bludgeoning";
    const category = DAMAGE_CATEGORIES.includes(categorySlug) ? categorySlug : null;
    if (["critical-only", "crit-only"].includes(categorySlug)) warnings.push(`Critical-only damage on ${attackName} is preserved in the text but cannot be represented as an NPC Strike damage category.`);
    rolls[index === 0 ? "main" : `extra${index}`] = { damage: formula, damageType, category };
    index += 1;
  }
  return rolls;
}

function parseFrequency(value) {
  const max = parseSignedInt(value) || 1;
  const per = value.match(/per\s+(round|minute|hour|day)/i)?.[1]?.toLowerCase() ?? "day";
  return { max, value: max, per };
}

function parseDuration(value) {
  const slug = slugify(value);
  if (["unlimited", "encounter"].includes(slug)) return { value: slug === "unlimited" ? -1 : 1, unit: slug, expiry: null, sustained: false };
  const match = String(value).match(/(\d+)\s*(round|minute|hour|day|turn|rounds|minutes|hours|days|turns)/i);
  return { value: Number(match?.[1] ?? 1), unit: slugify(match?.[2] ?? "round").replace(/s$/, ""), expiry: "turn-start", sustained: false };
}

function parseBadge(value) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? { type: "counter", value: number, min: 1, max: null, labels: null, loop: false } : null;
}

function parseArea(value) {
  if (!value) return null;
  const match = String(value).match(/(\d+)\s*(?:foot|feet|ft\.?)?\s*(burst|cone|emanation|line)/i);
  return match ? { value: Number(match[1]), type: slugify(match[2]) } : null;
}

function parseDistance(value) {
  const match = String(value ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseSignedInt(value) {
  const match = String(value ?? "").match(/[-+]?\d+/);
  return match ? Number(match[0]) : 0;
}

function parseActionCount(value) {
  const text = String(value).toLowerCase();
  if (text.includes("three") || text.includes("3")) return 3;
  if (text.includes("two") || text.includes("2")) return 2;
  return 1;
}

function normalizeActionType(value) {
  const slug = slugify(value);
  if (slug.includes("reaction")) return "reaction";
  if (slug.includes("free")) return "free";
  if (slug.includes("passive")) return "passive";
  return "action";
}

function normalizePrepared(value) {
  const slug = slugify(value);
  if (["prepared", "spontaneous", "innate", "focus", "ritual"].includes(slug)) return slug;
  return "innate";
}

function normalizeAbility(value) {
  const slug = slugify(value).slice(0, 3);
  return ABILITY_KEYS.includes(slug) ? slug : "cha";
}

function normalizeInventoryType(value) {
  const slug = slugify(value);
  return ["weapon", "armor", "shield", "consumable", "equipment", "backpack", "treasure"].includes(slug) ? slug : "equipment";
}

function actionIcon(type, actions) {
  if (type === "reaction") return "systems/pf2e/icons/actions/Reaction.webp";
  if (type === "free") return "systems/pf2e/icons/actions/FreeAction.webp";
  if (type === "passive") return "systems/pf2e/icons/actions/Passive.webp";
  return `systems/pf2e/icons/actions/${actions ?? 1}Action.webp`;
}

async function getOrCreateFolder() {
  const existing = game.folders.find((folder) => folder.type === "Actor" && folder.name === IMPORT_FOLDER);
  return existing ?? Folder.create({ name: IMPORT_FOLDER, type: "Actor" });
}

function splitList(value) {
  return String(value ?? "").split(/,|;/).map((part) => part.trim()).filter(Boolean);
}

function slugify(value) {
  return String(value ?? "").trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function firstWord(value) {
  return String(value ?? "").trim().split(/\s+/)[0];
}

function signed(value) {
  return Number(value) >= 0 ? `+${Number(value)}` : String(Number(value));
}

function normalizeName(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function exportActorToMarkdown(actor) {
  const system = actor.system;
  const lines = [
    `# ${actor.name}`,
    `Level: ${system.details?.level?.value ?? 1}`,
    `Rarity: ${system.traits?.rarity ?? "common"}`,
    `Size: ${system.traits?.size?.value ?? "medium"}`,
    `Traits: ${(system.traits?.value ?? []).join(", ")}`,
    `Perception: ${signed(system.perception?.mod ?? 0)}${system.perception?.senses?.length ? `; Senses: ${formatSenses(system.perception.senses)}` : ""}`,
    `Languages: ${(system.details?.languages?.value ?? system.languages?.value ?? []).join(", ")}`,
    `Skills: ${formatSkills(system.skills ?? {})}`,
    `Abilities: ${ABILITY_KEYS.map((key) => `${key.toUpperCase()} ${signed(system.abilities?.[key]?.mod ?? 0)}`).join(", ")}`,
    `AC: ${system.attributes?.ac?.value ?? 10}`,
    `Fortitude: ${signed(system.saves?.fortitude?.value ?? 0)}`,
    `Reflex: ${signed(system.saves?.reflex?.value ?? 0)}`,
    `Will: ${signed(system.saves?.will?.value ?? 0)}`,
    `HP: ${system.attributes?.hp?.max ?? system.attributes?.hp?.value ?? 10}`,
    formatIWR("Immunities", system.attributes?.immunities),
    formatIWR("Weaknesses", system.attributes?.weaknesses),
    formatIWR("Resistances", system.attributes?.resistances),
    `Speed: ${formatSpeed(system.attributes?.speed)}`,
    `Description: ${stripHtml(system.details?.publicNotes ?? "")}`
  ].filter(Boolean);

  const attacks = actor.items.filter((item) => item.type === "melee");
  if (attacks.length) lines.push("", "## Attacks", ...attacks.flatMap(exportAttack));
  const actions = actor.items.filter((item) => item.type === "action");
  if (actions.length) lines.push("", "## Actions", ...actions.flatMap(exportAction));
  const entries = actor.items.filter((item) => item.type === "spellcastingEntry");
  if (entries.length) lines.push("", "## Spellcasting", ...entries.flatMap((entry) => exportSpellcasting(entry, actor)));
  const inventory = actor.items.filter((item) => ["weapon", "armor", "shield", "consumable", "equipment", "backpack", "treasure"].includes(item.type));
  if (inventory.length) lines.push("", "## Inventory", ...inventory.flatMap(exportInventory));
  const effects = actor.items.filter((item) => item.type === "effect");
  if (effects.length) lines.push("", "## Effects", ...effects.flatMap(exportEffect));
  return `${lines.join("\n")}\n`;
}

function exportAttack(item) {
  const system = item.system;
  return [
    "",
    `### ${item.name}`,
    `Type: ${system.range ? "ranged" : "melee"}`,
    `Bonus: ${signed(system.bonus?.value ?? 0)}`,
    `Damage: ${formatDamageRolls(system.damageRolls ?? {})}`,
    system.range?.increment ? `Range: ${system.range.increment} feet` : "",
    system.area ? `Area: ${system.area.value}-foot ${system.area.type}` : "",
    `Traits: ${(system.traits?.value ?? []).join(", ")}`,
    (system.attackEffects?.value ?? []).length ? `Effects: ${system.attackEffects.value.join(", ")}` : "",
    `Description: ${stripHtml(system.description?.value ?? "")}`,
    formatRules(system.rules)
  ].filter(Boolean);
}

function exportAction(item) {
  const system = item.system;
  return ["", `### ${item.name}`, `Type: ${system.actionType?.value ?? "action"}`, `Actions: ${system.actions?.value ?? 1}`, `Category: ${system.category ?? "offensive"}`, `Traits: ${(system.traits?.value ?? []).join(", ")}`, `Description: ${stripHtml(system.description?.value ?? "")}`, formatRules(system.rules)].filter(Boolean);
}

function exportSpellcasting(entry, actor) {
  const spells = actor.items.filter((item) => item.type === "spell" && item.system.location?.value === entry.id);
  const grouped = new Map();
  for (const spell of spells) {
    const rank = spell.system.level?.value ?? 0;
    const label = spell.system.location?.uses?.max === -1 ? "At Will" : (rank === 0 ? "Cantrips" : String(rank));
    const suffix = spell.system.location?.signature ? " (signature)" : "";
    grouped.set(label, [...(grouped.get(label) ?? []), `${spell.name}${suffix}`]);
  }
  return [
    "",
    `### ${entry.name}`,
    `Tradition: ${entry.system.tradition?.value ?? "arcane"}`,
    `Type: ${entry.system.prepared?.value ?? "innate"}`,
    `Ability: ${entry.system.ability?.value ?? "cha"}`,
    `DC: ${entry.system.spelldc?.dc ?? 0}`,
    `Attack: ${signed(entry.system.spelldc?.value ?? 0)}`,
    "Description:",
    ...Array.from(grouped.entries()).map(([rank, names]) => `- ${rank}: ${names.join(", ")}`),
    formatRules(entry.system.rules)
  ].filter(Boolean);
}

function exportInventory(item) {
  const system = item.system;
  return ["", `### ${item.name}`, `Type: ${item.type}`, `Level: ${system.level?.value ?? 0}`, `Quantity: ${system.quantity ?? 1}`, `Traits: ${(system.traits?.value ?? []).join(", ")}`, `Description: ${stripHtml(system.description?.value ?? "")}`, formatRules(system.rules)].filter(Boolean);
}

function exportEffect(item) {
  const system = item.system;
  const aura = (system.rules ?? []).find((rule) => rule.key === "Aura");
  return ["", `### ${item.name}`, `Traits: ${(system.traits?.value ?? []).join(", ")}`, aura?.radius ? `Radius: ${aura.radius} feet` : "", `Duration: ${formatDuration(system.duration)}`, `Description: ${stripHtml(system.description?.value ?? "")}`, formatRules(system.rules)].filter(Boolean);
}

function formatDamageRolls(rolls) {
  return Object.values(rolls).map((roll) => `${roll.damage} ${roll.category ? `${roll.category} ` : ""}${roll.damageType}`).join(" plus ");
}

function formatSkills(skills) {
  return Object.entries(skills).map(([key, value]) => `${key} ${signed(value.base ?? value.mod ?? value.value ?? 0)}`).join(", ");
}

function formatSenses(senses) {
  return senses.map((sense) => `${sense.type}${sense.range ? ` ${sense.range} feet` : ""}`).join(", ");
}

function formatIWR(label, values = []) {
  return values.length ? `${label}: ${values.map((entry) => `${entry.type}${entry.value ? ` ${entry.value}` : ""}`).join(", ")}` : "";
}

function formatSpeed(speed) {
  const other = (speed?.otherSpeeds ?? []).map((entry) => `${entry.type} ${entry.value} feet`);
  return [`${speed?.value ?? 25} feet`, ...other].join(", ");
}

function formatDuration(duration) {
  if (!duration) return "unlimited";
  if (duration.value === -1) return "unlimited";
  return `${duration.value ?? 1} ${duration.unit ?? "round"}`;
}

function formatRules(rules = []) {
  return rules.length ? `RuleElements:\n${rules.map((rule) => `- ${JSON.stringify(rule)}`).join("\n")}` : "";
}

function stripHtml(value) {
  return String(value ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function sampleStatBlock() {
  return `# Ember Drake Warden
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
`;
}
