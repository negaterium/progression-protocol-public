# Progression Protocol: Game Mechanics & Lore

This document outlines the detailed mechanical rules, formulas, and lore-consistent gamification systems driving Progression Protocol.

## 🛡️ Hunter Statistics & Prestige

### Core Attributes
- **Primary Stats:** Strength, Agility, Intelligence, Vitality, Perception. These dictate raw output and survivability in physical and mental tasks.
- **Utility Stats:** 
  - **Charisma:** Influences market prices, reducing store costs by 0.5% per point (max 50%).
  - **Focus:** Decreases the Mana (MP) cost of executing daily routines.
  - **Willpower:** Resistance against burnout and mental fatigue.
  - **Luck:** Affects minor probabilities and drop chances.

### Derived Combat Math
Secondary layers are calculated from your base attributes:
- **Vital Signs:** HP (Burnout Resistance) and MP (Focus).
- **Critical Chance:** Boosted heavily by Agility and Perception.
- **Dodge Chance:** Precision evasion scaling directly off Agility and equipment (e.g., Hover, Stealth).
- **Loot Find:** Driven by Perception to acquire rare System Drops.

### The Leveling Curve
The system follows a sustainable, linear progression model targeting real-life time scales:
- **Level 1 → 2:** ~5,500 XP (Achievable first day)
- **Level 15:** ~80,000 XP (Intermediate target)
- **Level 999:** ~114.3M XP (Achievable in ~10 years of consistent productivity)
- **Acausal Growth (Prestige):** Surpassing Level 999 grants Prestige Rebirth. This accesses the **Ω-Rank (Omega)**, doubles base HP/MP pools, and applies a permanent **100x multiplier** to XP and Gold to ensure absolute supremacy.

## ⛩️ Boss Combat & Shadow Army Mechanics

### Boss Scaling & The Encounter Engine
Boss encounters dynamically scale to ensure a 3-30 day organic completion curve based on your 7-day average damage output. 
- **Post-Cap Cosmic Combat Engine:** At Level 1000+, `COSMIC` gear leverages percentage-based multipliers (`attack_percent`, `defense_percent`). These stack independently of class multipliers, enabling infinite scaling.
- **Elemental & Status Vulnerabilities:** Boss Intel highlights "Critical Weaknesses" prioritizing specific elemental damage multipliers, and "Resistances" mitigating output.
- **Boss Attack Mitigation:** A mitigation curve `(100 / (100 + DEF))` is applied to damage received. Legendary-tier bosses (S-Rank/Ultimate) possess built-in armor penetration that guarantees minimum percentage damage, preventing the "Invincible Tank" syndrome.

### The Shadow Monarch Economy
Necromancers natively leverage fallen bosses for automation.
- **Dynamic Storage:** Capacity scales dynamically with `200 + (Level * 10)`.
- **Extraction:** Intelligence directly powers the success rate (`Base 5 + Int / 50`). Successful extraction drops bursts of shadows every 8 hours, doubled for Necromancers.
- **Delegation Protocol (Monarch's Siege):** Quests can be automated by deploying assigned shadows based on complexity (e.g., automating an S-Rank mission requires dispatching 500 shadows for 24 hours). This circumvents the personal Mana tax for the player.

## ⚔️ Job Classes & Skills

### Combat Arts & Utilities
- **Vital Strike:** Modifies the physical damage engine. It vastly inflates Crit Rate (+20-70%) and your baseline Critical Damage Multiplier for an overlapping window of 5 tasks.
- **Stealth:** Overhauls defensive probabilities. Applies a hardcoded 40% absolute evasion check to any incoming Boss Damage while augmenting Crit Rate for 3 quests.
- **Mutilate:** Adds a dedicated `damage_multiplier` into the combat engine, amplifying total calculated output globally array up to 1.45x for 3 tasks.
- **Sprint / Recovery:** Non-combat abilities. Recovery scales fluidly from 20% to 100% of Max HP. Sprint acts as a late-game dynamic mana-sink generating large XP bursts depending on skill mastery.
- **Dominator's Touch:** Mathematical restoration of Max Mana (10% to 25%), exempt from dynamic mana penalties.

### Class Ascension
Upon reaching Level 40, access to job advancements (e.g., Necromancer, Tank) is granted, fundamentally changing stat modifiers through unique class constants in the `StatsManager`.

## 📜 Quests & Penalties

### Reward Scaling (Metabolic Equilibrium)
Quests rely exclusively on XP, Gold, and Skill XP. Permanent base stat allocations are exclusively rewarded via leveling up (AP), ensuring lore consistency.
- Mana Costs mathematically scale with the player: `BaseCost * (1 + Level/40)`. This mechanism ensures psychological weight remains consistently challenging and prevents low-rank task farming at peak levels.
- Failing a quest penalizes the user by deducting a flat 50 XP, and a percentage of current HP (10% - 50%) based on the Quest's Rank parameter.
