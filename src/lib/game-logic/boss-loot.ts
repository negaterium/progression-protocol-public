export const BOSS_LOOT_TABLE: Record<string, { itemName: string, chance: number, quantity: number }[]> = {
    // PHASE 1: INITIATION
    "Blue Venom-Fanged Kasaka": [
        { itemName: "Kasaka's Venom Fang", chance: 1.0, quantity: 1 },
        { itemName: "Kasaka's Venom Pouch", chance: 0.5, quantity: 1 }
    ],
    "Giant Arachnid Buryura": [
        { itemName: "Arachnid's Fang", chance: 1.0, quantity: 1 },
        { itemName: "Chitin Chestplate", chance: 0.5, quantity: 1 }
    ],
    "Hwang Dongsuk": [
        { itemName: "Heavy Plated Greaves", chance: 1.0, quantity: 1 },
        { itemName: "Healing Potion", chance: 0.8, quantity: 2 }
    ],
    "Blood-Red Commander Igris": [
        { itemName: "Igris's Helmet", chance: 1.0, quantity: 1 },
        { itemName: "Red Knight's Helmet", chance: 0.1, quantity: 1 } // Alternate/Rare
    ],
    "Ashborn (Shadow Monarch)": [
        { itemName: "Scythe of the Shadow Monarch", chance: 0.1, quantity: 1 },
        { itemName: "Cloak of the Shadow Monarch", chance: 1.0, quantity: 1 }
    ],

    // PHASE 2: ASCENSION
    "Cerberus (Gatekeeper)": [
        { itemName: "Warden's Necklace", chance: 1.0, quantity: 1 },
        { itemName: "Bread of the Gatekeeper", chance: 0.5, quantity: 1 }
    ],
    "Baruka (Ice Elf Leader)": [
        { itemName: "Baruka's Dagger", chance: 1.0, quantity: 1 },
        { itemName: "Ice Bear's Robe", chance: 0.5, quantity: 1 }
    ],
    "Avaricious Vulcan": [
        { itemName: "Vulcan's Horn", chance: 1.0, quantity: 1 },
        { itemName: "Demon Monarch's Ring", chance: 0.2, quantity: 1 }
    ],
    "Metus (Soul Shepherd)": [
        { itemName: "Mage's Staff", chance: 1.0, quantity: 1 },
        { itemName: "Greater Mana Potion", chance: 1.0, quantity: 3 }
    ],
    "Kargalgan (Orc Shaman)": [
        { itemName: "Tusk's Orb of Avarice", chance: 1.0, quantity: 1 },
        { itemName: "High Orc's Shield", chance: 0.5, quantity: 1 }
    ],

    // PHASE 3: CALAMITY
    "Statue of God": [
        { itemName: "Holy Water of Life", chance: 0.05, quantity: 1 },
        { itemName: "Elixir of Vitality", chance: 1.0, quantity: 1 }
    ],
    "Ant King (Beru)": [
        { itemName: "Antidote of the System", chance: 1.0, quantity: 1 },
        { itemName: "Assassin's Boots", chance: 0.5, quantity: 1 } // Creating distance/speed
    ],
    "Kamish (The Dragon)": [
        { itemName: "Kamish's Wrath", chance: 0.1, quantity: 2 }, // Dual Daggers usually
        { itemName: "Crown of the Dragon", chance: 1.0, quantity: 1 }
    ],
    "The Architect (Kandiaru)": [
        { itemName: "Cup of Reincarnation", chance: 0.1, quantity: 1 },
        { itemName: "Elixir of Intelligence", chance: 1.0, quantity: 1 }
    ],
    "Baran (Monarch of White Flames)": [
        { itemName: "Cloak of the Flame Monarch", chance: 1.0, quantity: 1 },
        { itemName: "Baran's Dagger", chance: 0.5, quantity: 1 },
        { itemName: "Demon King's Longsword", chance: 0.5, quantity: 1 }
    ],

    // PHASE 4: MONARCHS
    "Legia (Monarch of the Beginning)": [
        { itemName: "Void Stalker Boots", chance: 1.0, quantity: 1 },
        { itemName: "Elixir of Strength", chance: 1.0, quantity: 1 }
    ],
    "Querehsha (Monarch of Plagues)": [
        { itemName: "Antidote", chance: 1.0, quantity: 5 },
        { itemName: "Serpent Scale Mail of Plague", chance: 1.0, quantity: 1 }
    ],
    "Sillad (Monarch of Frost)": [
        { itemName: "Greaves of the Frost Monarch", chance: 1.0, quantity: 1 },
        { itemName: "Frostbite Axe", chance: 0.3, quantity: 1 }
    ],
    "Rakan (Monarch of Beastly Fangs)": [
        { itemName: "Fang of Rakan", chance: 1.0, quantity: 1 },
        { itemName: "Gauntlets of the Ogre", chance: 0.5, quantity: 1 }
    ],
    "Yogumunt (Monarch of Transfiguration)": [
        { itemName: "Sovereign's Transfiguration Ring", chance: 1.0, quantity: 1 },
        { itemName: "Gloves of the Thief", chance: 0.5, quantity: 1 }
    ],
    "Tarnak (Monarch of Iron Body)": [
        { itemName: "Iron Gauntlets of the Monarch", chance: 1.0, quantity: 1 },
        { itemName: "Potion of the Iron Body", chance: 1.0, quantity: 3 }
    ],
    "Antares (Monarch of Destruction)": [
        { itemName: "Wrath of Antares", chance: 0.1, quantity: 1 },
        { itemName: "Crown of Destruction", chance: 1.0, quantity: 1 }
    ],

    // PHASE 5: OUTER GODS
    "Itarim (Outer God)": [
        { itemName: "Itarim's Void Dagger", chance: 0.1, quantity: 1 },
        { itemName: "Void Sovereign's Helm", chance: 1.0, quantity: 1 }
    ],
    "Apostles of Itarim": [
        { itemName: "Scroll of the Labyrinth", chance: 1.0, quantity: 1 },
        { itemName: "Mana Infused Coffee", chance: 1.0, quantity: 5 }
    ],

    // ============================================
    // PHASE 6: THE BEYOND (COSMIC RANK — Post-999 Only)
    // ============================================

    "Azathoth, The Blind Idiot God": [
        { itemName: "Crown of the Idiot God", chance: 1.0, quantity: 1 },          // Guaranteed helmet
        { itemName: "Flute of the Outer Chaos", chance: 0.5, quantity: 1 },        // Rare accessory
        { itemName: "Fragment of Azathoth", chance: 0.25, quantity: 1 },           // Ultra-rare crafting material
    ],

    "Tiamat, The Chromatic Sovereign": [
        { itemName: "Chromatic Scale Armor", chance: 1.0, quantity: 1 },           // Guaranteed armor with all elemental resists
        { itemName: "Tiamat's Prismatic Fang", chance: 0.5, quantity: 1 },         // Rare weapon
        { itemName: "Dragon Sovereign's Ring", chance: 0.25, quantity: 1 },        // Ultra-rare accessory
    ],

    "Vecna, The Whispered One": [
        { itemName: "Eye of Vecna", chance: 1.0, quantity: 1 },                    // Guaranteed accessory (INT + cosmic_resist)
        { itemName: "Hand of Vecna", chance: 0.5, quantity: 1 },                   // Rare gloves (STR + void_strike)
        { itemName: "Tome of Forbidden Secrets", chance: 0.25, quantity: 1 },      // Ultra-rare (XP multiplier)
    ],

    "Nyarlathotep, The Crawling Chaos": [
        { itemName: "Mask of a Thousand Forms", chance: 1.0, quantity: 1 },        // Guaranteed helmet (AGI + cosmic_damage_bonus)
        { itemName: "Chaos Shard", chance: 0.5, quantity: 3 },                     // Rare crafting material (stackable)
        { itemName: "Cloak of the Crawling Chaos", chance: 0.25, quantity: 1 },    // Ultra-rare armor
    ],

    "Atropus, The World Born Dead": [
        { itemName: "Atropus's Necrotic Core", chance: 1.0, quantity: 1 },         // Guaranteed accessory (entropy_convert)
        { itemName: "Gauntlets of Negative Energy", chance: 0.5, quantity: 1 },    // Rare gloves
        { itemName: "Shroud of the Dead World", chance: 0.25, quantity: 1 },       // Ultra-rare armor (hp_percent + cosmic_resist)
    ],
};
