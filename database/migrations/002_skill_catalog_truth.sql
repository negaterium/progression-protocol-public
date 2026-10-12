-- Align the shared skill catalog with the reviewed runtime contract.
-- Applied by scripts/database/migrate.ts inside one transaction.
DO $migration$
DECLARE skill_count integer; updated_count integer;
BEGIN
    SELECT count(*) INTO skill_count FROM public.skills;
    IF skill_count <> 38 THEN
        RAISE EXCEPTION 'Expected 38 shared skills, found %.', skill_count;
    END IF;

    WITH reviewed(id, description, active_effect) AS (
    VALUES
        ('06baae4b-cd39-493e-8293-a3c498a36e94'::uuid, 'Focus on vital points. For 5 Quests, gain +20% Critical Rate + 5% per Rank and +0.5x Critical Damage + 0.1x per Rank. Permanent imprint: +1 Strength per character level; each rank after Rank 1 increases the imprint by 20%. Cooldown: 4 hours.', 'Critical Rate +20% + 5% per Rank and Critical Damage +0.5x + 0.1x per Rank for 5 Quests.'),
        ('085ba210-8d06-42f0-ac77-312a8a53f424'::uuid, 'Move like the wind. For 5 Quests, gain 1.20x XP + 0.10x per Rank. Permanent imprint: +1 Agility per character level; each rank after Rank 1 increases the imprint by 20%. Cooldown: 8 hours, reduced by 30 minutes per rank after Rank 1.', 'XP Gain 1.20x + 0.10x per Rank for 5 Quests.'),
        ('0c0851c2-1df6-4368-80df-6cb79c72c17d'::uuid, 'Master the dagger''s path. Passive combat effect: +5% Dagger Damage per Rank, capped at 50%; main-hand daggers only. Passive imprint: +1 Agility per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('0df86c12-cd5a-4638-b0a0-907f3ccd4378'::uuid, 'Enter the zone where distractions cannot reach you. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('1257919e-44ba-405b-93a6-289edfe6730b'::uuid, 'Raise a barrier of pure mana. Passive combat effect: diverts 5% of incoming Boss Damage to MP per Rank, capped at 50%; only available MP can be spent. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('22f0e654-734e-480e-adf4-3001c41d84f1'::uuid, 'Expand the Monarch''s Territory. Passive army effect: 5% Shadow Army Damage per Rank for assigned and passive attacks, capped at 50%. Passive imprints: +1 Strength and +2 Intelligence per character level; each rank after Rank 1 increases these imprints by 20%.', NULL),
        ('2bb469e8-6753-4c5b-9620-98157cbcb5c2'::uuid, 'Read the weak point in every defense. Passive combat effect: +2% Critical Rate per Rank. Passive imprint: +1 Agility per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('2e4c0e3d-74fa-44dd-ad0a-d7a753dbb9ad'::uuid, 'Release a provocative aura and stand unshaken. Passive combat effect: +5% Defense against Boss attacks per Rank, capped at 50%. Passive imprint: +1 Vitality per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('33e356c7-0370-4c2d-b516-1569907527b0'::uuid, 'Break your limits. Ultimate passive imprint: +1 to every core stat per Rank.', NULL),
        ('342730ad-5161-4170-bf9d-6aef0348b0d5'::uuid, 'Unravel the mathematical truths of the universe. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('3baaed0a-cd78-4d3b-92bd-cfd5ccfc3ca5'::uuid, 'Harden your body into a fortress. Passive combat effect: +3% Boss Damage Reduction per Rank, capped at 30%. Passive imprint: +2 Vitality per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('4d5f335e-f54d-462e-b896-0266ab527c8c'::uuid, 'Move like a blade of quicksilver. Passive combat effect: +5% Attack Speed and second-strike chance per Rank, capped at 50%. Passive imprint: +1 Agility per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('538c1558-d23b-4d49-8d08-2fd8295f5c63'::uuid, 'Condense mana into a volatile sphere of flame. Passive combat effect: +5% Magic Damage per Rank, capped at 50%; applies to magic-archetype attacks. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('57f7b0a5-fcf0-4f81-8de8-09dfba05784f'::uuid, 'Harden your resolve against the wear of endless grinding. Passive combat effect: +3% Armor against Boss attacks per Rank, capped at 30%. Passive imprint: +1 Vitality per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('58d19a43-70fe-433b-a31f-09d797f36926'::uuid, 'Speak the language of the machine gods. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('5dac621e-4b4c-4f0c-95ab-6c1887bb993e'::uuid, 'Architect the unseen structures that govern reality. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('5fe65d77-3448-43ef-b94a-09b807712343'::uuid, 'Step through the shadow dimension and strike from the blind side. Passive combat effect: +5% Boss Evasion per Rank, capped at 50%; alongside +1 Agility per character level, with each rank after Rank 1 increasing the imprint by 20%.', NULL),
        ('6bf80709-1507-4ecf-a1d0-6a147913f334'::uuid, 'Vanish from the System''s gaze. For 3 Quests, gain +40% Boss Evasion and +20% Critical Rate + 5% per Rank. Permanent imprint: +1 Agility per character level; each rank after Rank 1 increases the imprint by 20%. Cooldown: 4 hours.', 'Boss Evasion +40% and Critical Rate +20% + 5% per Rank for 3 Quests.'),
        ('6f934f17-0ac4-4135-8c77-e050c4828b71'::uuid, 'Siphon the life force of your enemy. Passive combat effect: restores 2% of direct damage dealt as HP per Rank, capped at 20%. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('742c53d2-ae1d-43cd-a005-daeece401323'::uuid, 'Afflict the target with a lingering dark curse. Passive combat effect: adds 0.5% of current Boss HP as curse pressure per Rank, capped at 5%, on each attack. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('79d65557-dbc0-4c61-8a2d-3fde080fffb6'::uuid, 'Strike with overwhelming force. For 3 Quests, deal 1.20x Global Damage + 0.05x per Rank. Permanent imprint: +1 Strength per character level; each rank after Rank 1 increases the imprint by 20%. Cooldown: 4 hours.', 'Global Damage 1.20x + 0.05x per Rank for 3 Quests.'),
        ('7c87c82a-4f84-430e-813c-961b60981cf7'::uuid, 'Manipulate the flow of your schedule. Passive imprint: +1 Perception per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('8a541518-7462-40db-806f-3137362642b2'::uuid, 'Cleanse the body of impurities. Passive recovery effect: 10% chance per Rank at quest start to cleanse ordinary negative statuses, capped at 100%; Reality Fracture, Cosmic Dread, Entropy and System Interference remain outside this cleanse. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('93718b6a-7a58-4294-ba2c-de586581214b'::uuid, 'ARISE. Attempts to extract a Shadow Soldier at 50% success + 5% per Rank. Necromancers and Shadow Monarchs are guaranteed. Permanent imprint: +2 Intelligence per character level; each rank after Rank 1 increases the imprint by 20%. Cooldown: 8 hours.', '50% extraction chance + 5% per Rank; Necromancers and Shadow Monarchs are guaranteed.'),
        ('9527ffb1-f68e-4aac-83e9-af2c51ea3823'::uuid, 'The ultimate synchronization of mind and action. Passive imprint: +2 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('a0d9b283-c6f7-405a-897b-0200a837beb8'::uuid, 'Call forth roots from the earth and bind your focus. Passive control effect: 5% chance per Rank per quest to root a non-cosmic Boss for one round, capped at 50%. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('a9144cb6-58a1-4322-a6cc-9bb6c245daba'::uuid, 'Tap into the primal aspect of the Bear. Passive imprints: +1 Strength and +1 Vitality per character level; each rank after Rank 1 increases these imprints by 20%.', NULL),
        ('aabb8bc2-b7ae-4e0b-bcca-4ffd8c0d2393'::uuid, 'Enter a state of pure concentration. Passive resource effect: -2% Quest Mana Cost per Rank, capped at 20%. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('ad971e12-eda8-4978-9dea-9e5226cab3b7'::uuid, 'Read intention and presence through the System. Passive imprint: +1 Perception per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('c0cd4574-c044-4679-a8bd-f35570306569'::uuid, 'Channel divine energy to restore vitality. Passive recovery effect: +5% direct Healing Received per Rank, capped at 50%. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('d6204fa9-2aef-4ef0-9b1b-60f013c7f0c7'::uuid, 'Outlast ordinary limits. Passive survival effect: +5% Max HP per Rank, capped at 50%. Passive imprint: +2 Vitality per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('def99603-b6bf-4dff-a56d-7496c019600e'::uuid, 'Enter a state of total zen. Passive recovery effect: +5% HP and MP Regeneration per Rank, capped at 50%. Passive imprint: +1 Intelligence per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('e5e66701-6775-4685-9207-713b322bb26c'::uuid, 'Restore 20% of Max HP per Rank instantly, capped at 100%. Cooldown: 8 hours.', 'Restores 20% of Max HP per Rank, capped at 100%.'),
        ('e82d25c4-7e37-49ab-8aa2-6c54ed8bbdcb'::uuid, 'Intimidate enemies with the pressure of a ruler. Passive combat effect: +5% Physical Damage per Rank, capped at 50%. Passive imprint: +1 Strength per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('e947a033-296e-4a75-9eda-a3ff77cb306f'::uuid, 'Ruler''s Authority over mana and matter. Restore 10% Max MP + 5% per Rank; for 2 Quests, crush Boss Defense by 20% + 2% per Rank and apply 2% current Boss HP pressure per task. Permanent imprint: +1 Intelligence per character level; each rank after Rank 1 increases the imprint by 20%. Cooldown: 1 hour.', 'Restores 10% Max MP + 5% per Rank; applies 20% Boss Defense Crush + 2% per Rank and 2% current Boss HP pressure for 2 Quests.'),
        ('fa5e1906-ae7d-498c-b040-8634e06e1ed5'::uuid, 'Make your body a weapon. Passive combat effect: +10% Unarmed Damage per Rank, capped at 50%; equipped weapon attacks are unchanged. Passive imprint: +1 Strength per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('fa6a75b0-fcb8-4d5f-9bc0-867a68cdee82'::uuid, 'Withstand mental and physical fatigue. Passive imprint: +1 Vitality per character level; each rank after Rank 1 increases this imprint by 20%.', NULL),
        ('fb14764d-8d90-4e25-8044-c4e233a72b1c'::uuid, 'Stand firm against hostile effects. Passive combat effect: +5% Boss Status Resistance per Rank, capped at 50%; effects marked unresistable still apply. Passive imprint: +1 Vitality per character level; each rank after Rank 1 increases this imprint by 20%.', NULL)
    )
    UPDATE public.skills AS skills
    SET description = reviewed.description, active_effect = reviewed.active_effect
    FROM reviewed
    WHERE skills.id = reviewed.id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 38 THEN
        RAISE EXCEPTION 'Expected to update 38 shared skills, updated %.', updated_count;
    END IF;
END
$migration$;
