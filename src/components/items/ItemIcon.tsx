"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import {
    FlaskConical,
    Sword,
    Shield,
    Shirt,
    Footprints,
    Key,
    Gem,
    Box,
    Scroll,
    Gavel,
    Crown,
    Ticket,
    Circle,
    Columns,
    Apple,
    Cookie,
    Hexagon,
    Hand
} from "lucide-react";

interface ItemIconProps {
    item: {
        name: string;
        type: string;
        slot?: string;
        effect?: {
            slot?: string;
            [key: string]: any;
        } | null;
    };
    className?: string;
}

export function ItemIcon({ item, className }: ItemIconProps) {
    const name = item.name.toLowerCase();
    const type = item.type;
    const slot = item.slot || item.effect?.slot || 'NONE';

    // Logic to pick image
    let imageSrc: string | null = null;

    if (type === 'EQUIPMENT') {
        if (slot === 'HEAD') {
            if (name.includes('igris')) imageSrc = '/items/igriss-helmet.webp';
            // XX: Shadow Monarch crown
            else if (name.includes('shadow monarch') && (name.includes('crown') || name.includes('helm'))) imageSrc = '/items/shadow-monarch-crown.webp';
            // COSMIC: Idiot God / Mask of a Thousand Forms
            else if (name.includes('idiot god') || name.includes('thousand forms') || (name.includes('mask') && !name.includes('assassin'))) imageSrc = '/items/cosmic-mask.webp';
            else imageSrc = '/items/head.webp';
        }
        else if (slot === 'CHEST') {
            if (name.includes('ice bear')) imageSrc = '/items/ice-bears-robe.webp';
            // COSMIC: Chromatic Scale Armor, Crawling Chaos, Dead World
            else if (name.includes('chromatic scale') || name.includes('crawling chaos') || name.includes('dead world')) imageSrc = '/items/cosmic-armor.webp';
            else imageSrc = '/items/leather-armor-premium.webp';
        }
        else if (slot === 'LEGS') imageSrc = '/items/premium-pants.webp';
        else if (slot === 'FEET') imageSrc = '/items/premium-boots.webp';
        else if (slot === 'ACCESSORY') {
            if (name.includes('warden')) imageSrc = '/items/wardens-necklace.webp';
            else imageSrc = '/items/premium-ring.webp';
        }
        else if (slot === 'MAIN_HAND') {
            if (name.includes('kasaka')) imageSrc = '/items/kasakas-venom-fang.webp';
            // XX / S+ Scythes — specific names first
            else if (name.includes('scythe of the void') || name.includes('fang of rakan')) imageSrc = '/items/xx-scythe.webp';
            else if (name.includes('shadow monarch')) imageSrc = '/items/shadow-monarch-scythe.webp';
            else if (name.includes('kamish')) imageSrc = '/items/kamish-wrath.webp';
            else if (name.includes('baruka')) imageSrc = '/items/barukas-dagger.webp';
            else if (name.includes('vulcan')) imageSrc = '/items/vulcans-horn.webp';
            // XX: Wrath of Antares
            else if (name.includes('wrath of antares') || name.includes('wrath')) imageSrc = '/items/wrath-antares.webp';
            // XX: Itarim's Void Dagger
            else if (name.includes("itarim") || name.includes('void dagger')) imageSrc = '/items/void-dagger.webp';
            // COSMIC: Tiamat's Prismatic Fang
            else if (name.includes('tiamat') || name.includes('prismatic fang')) imageSrc = '/items/tiamat-fang.webp';
            else if (name.includes('sword') || name.includes('blade')) imageSrc = '/items/steel-sword-premium.webp';
            else imageSrc = '/items/weapon.webp';
        }
        else if (slot === 'OFF_HAND') {
            // COSMIC off-hands
            if (name.includes('vecna') || name.includes('hand of vecna')) imageSrc = '/items/hand-vecna.webp';
            else if (name.includes('tome') || name.includes('forbidden secrets')) imageSrc = '/items/cosmic-tome.webp';
            else imageSrc = '/items/iron-buckler.webp';
        }
        else if (slot === 'HANDS') {
            // COSMIC: Gauntlets of Negative Energy
            if (name.includes('negative energy')) imageSrc = '/items/cosmic-gauntlet.webp';
            else imageSrc = '/items/hands.png';
        }
    } else if (type === 'CONSUMABLE' || type === 'MISC' || type === 'KEY') {
        if (name.includes('key') || type === 'KEY') {
            imageSrc = '/items/dungeon-key-d.webp';
        }
        else if (name.includes('elixir of strength')) imageSrc = '/items/elixir-strength.webp';
        else if (name.includes('elixir of intelligence')) imageSrc = '/items/elixir-intelligence.webp';
        else if (name.includes('elixir of vitality')) imageSrc = '/items/elixir-vitality.webp';
        else if (name.includes('bandage')) imageSrc = '/items/bandages.webp';
        else if (name.includes('greater mana')) imageSrc = '/items/greater-mana-potion.webp';
        else if (name.includes('mana') || name.includes('mp')) imageSrc = '/items/mana-potion-premium.webp';
        else if (name.includes('healing') || name.includes('health') || name.includes('hp')) imageSrc = '/items/healing-potion-premium.webp';
        else if (name.includes('iron body')) imageSrc = '/items/potion-iron-body.webp';
        else if (name.includes('venom') && (name.includes('gland') || name.includes('pouch'))) imageSrc = '/items/kasaka-venom-pouch.webp';
        else if (name.includes('holy water')) imageSrc = '/items/holy-water-of-life.webp';
        else if (name.includes('purified blood')) imageSrc = '/items/purified-blood-demon-king.webp';
        else if (name.includes('antidote') && type === 'CONSUMABLE') imageSrc = '/items/system-antidote.webp';
        else if (name.includes('coffee')) imageSrc = '/items/mana-infused-coffee.webp';
        else if (name.includes('reincarnation')) imageSrc = '/items/cup-of-reincarnation.webp';
        else if (name.includes('essence')) imageSrc = '/items/essence-of-arise.webp';
        else if (name.includes('scroll')) imageSrc = '/items/scroll-of-the-labyrinth.webp';
        else if (name.includes('elvenwood')) imageSrc = '/items/elvenwood-fruit.webp';
        else if (name.includes('bread') && name.includes('gatekeeper')) imageSrc = '/items/bread-of-the-gatekeeper.webp';
        else if (name.includes('vulcan') && name.includes('horn')) imageSrc = '/items/vulcans-horn.webp';
        // COSMIC consumables
        else if (name.includes('chaos shard') || name.includes('shard')) imageSrc = '/items/cosmic-shard.webp';
        else if (name.includes('fragment') || name.includes('azathoth')) imageSrc = '/items/cosmic-shard.webp';
    }

    if (imageSrc) {
        return (
            <div className={cn("relative inline-block aspect-square overflow-hidden", className)}>
                <Image
                    src={imageSrc}
                    alt={item.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100px, 50px"
                />
            </div>
        );
    }

    // Logic to pick icon (Fallback)
    let Icon = Box;

    if (type === 'CONSUMABLE') {
        if (name.includes('potion') || name.includes('elixir')) Icon = FlaskConical;
        else if (name.includes('bandage')) Icon = Scroll;
        else if (name.includes('water')) Icon = FlaskConical;
        else if (name.includes('bread')) Icon = Cookie;
        else if (name.includes('fruit')) Icon = Apple;
        else if (name.includes('shard') || name.includes('fragment')) Icon = Hexagon;
        else if (name.includes('key')) Icon = Key;
        else Icon = FlaskConical;
    } else if (type === 'KEY') {
        Icon = Key;
    } else if (type === 'EQUIPMENT') {
        // Fallbacks if images fail or unmapped slots appear
        if (slot === 'HEAD') Icon = Crown;
        else if (slot === 'CHEST') Icon = Shirt;
        else if (slot === 'LEGS') Icon = Columns;
        else if (slot === 'FEET') Icon = Footprints;
        else if (slot === 'HANDS') Icon = Hand;
        else if (slot === 'ACCESSORY') {
            if (name.includes('ring')) Icon = Circle;
            else if (name.includes('belt')) Icon = Columns;
            else Icon = Gem;
        }
        else if (slot === 'MAIN_HAND' || slot === 'OFF_HAND') {
            if (name.includes('shield')) Icon = Shield;
            else if (name.includes('staff')) Icon = Gavel;
            else if (name.includes('dagger')) Icon = Sword;
            else {
                Icon = slot === 'OFF_HAND' ? Shield : Sword;
            }
        } else {
            Icon = Shield;
        }
    } else {
        if (name.includes('ticket')) Icon = Ticket;
    }

    return <Icon className={cn("inline-block", className)} />;
}
