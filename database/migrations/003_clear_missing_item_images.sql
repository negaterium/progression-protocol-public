-- Remove six catalog image URLs whose files were never present in the package.
-- The seed catalog uses NULL for new databases; this migration keeps existing
-- installations aligned without touching player-owned data.
DO $migration$
DECLARE
    item_count integer;
BEGIN
    SELECT count(*)
      INTO item_count
      FROM public.items
     WHERE id IN (
        '32b889d9-ca5e-461b-9071-8140ff54faa7'::uuid,
        '3edcd33e-1455-4c53-a086-b8f930ca7a52'::uuid,
        '8aeca4a7-4991-461b-a33d-40a3469a2273'::uuid,
        'ab1bc155-4182-4fe1-82a7-a78ccb5a58a7'::uuid,
        'd17593a5-493e-4098-9497-7a3e1bd20d29'::uuid,
        'd72516e3-cabb-4983-acf9-10bad48c947e'::uuid
     );

    IF item_count <> 6 THEN
        RAISE EXCEPTION 'Expected six reviewed catalog items, found %.', item_count;
    END IF;

    UPDATE public.items
       SET image_url = NULL
     WHERE id IN (
        '32b889d9-ca5e-461b-9071-8140ff54faa7'::uuid,
        '3edcd33e-1455-4c53-a086-b8f930ca7a52'::uuid,
        '8aeca4a7-4991-461b-a33d-40a3469a2273'::uuid,
        'ab1bc155-4182-4fe1-82a7-a78ccb5a58a7'::uuid,
        'd17593a5-493e-4098-9497-7a3e1bd20d29'::uuid,
        'd72516e3-cabb-4983-acf9-10bad48c947e'::uuid
     );
END;
$migration$;
