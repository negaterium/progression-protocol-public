"use client";

import { useEffect, useState } from "react";
import { LevelUpModal } from "./LevelUpModal";

// Key used to persist the pending level-up through any component remounts or router refreshes.
const PENDING_LEVEL_KEY = "solo_pending_level_up";

interface LevelManagerProps {
    initialLevel: number;
}

export function LevelManager({ initialLevel }: LevelManagerProps) {
    const [displayLevel, setDisplayLevel] = useState(() => {
        // Synchronously read pending level from localStorage on initial render.
        // This runs ONCE and is safe - it's a lazy initializer, not a side effect.
        if (typeof window !== 'undefined') {
            const pendingStr = localStorage.getItem(PENDING_LEVEL_KEY);
            if (pendingStr) {
                const pendingLevel = parseInt(pendingStr, 10);
                if (!isNaN(pendingLevel) && pendingLevel > 0) {
                    console.log(`[LevelManager] Lazy init: found pending level ${pendingLevel}`);
                    return pendingLevel;
                }
            }
        }
        return initialLevel;
    });

    const [showModal, setShowModal] = useState(() => {
        // Show modal immediately on mount if there's a pending level-up
        if (typeof window !== 'undefined') {
            const pendingStr = localStorage.getItem(PENDING_LEVEL_KEY);
            if (pendingStr) {
                const pendingLevel = parseInt(pendingStr, 10);
                return !isNaN(pendingLevel) && pendingLevel > 0;
            }
        }
        return false;
    });


    // Listen for the global LEVEL_UP event.
    // This fires on the first render after quest completion, before any router.refresh.
    useEffect(() => {
        const handleLevelUp = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail || detail.type !== 'LEVEL_UP') return;

            let newLevel: number = initialLevel + 1;
            if (typeof detail.newLevel === 'number' && detail.newLevel > 0) {
                newLevel = detail.newLevel;
            }

            console.log(`[LevelManager] LEVEL_UP event received: ${newLevel}`);

            // Store in localStorage FIRST so it survives any subsequent remount
            localStorage.setItem(PENDING_LEVEL_KEY, String(newLevel));

            setDisplayLevel(newLevel);
            setShowModal(true);
        };

        window.addEventListener('solo_achievement', handleLevelUp);
        return () => window.removeEventListener('solo_achievement', handleLevelUp);
    }, [initialLevel]);

    const handleClose = () => {
        // Clear the pending level-up from localStorage now that the user has seen it
        localStorage.removeItem(PENDING_LEVEL_KEY);
        setShowModal(false);
    };

    return (
        <LevelUpModal
            newLevel={displayLevel}
            isOpen={showModal}
            onClose={handleClose}
        />
    );
}
