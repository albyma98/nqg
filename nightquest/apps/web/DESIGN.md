# NightQuest Design

## Token

- I token utente sono definiti in `src/styles/tokens.css`.
- Tailwind estende colori, tipografia, motion e radius in `tailwind.config.js`.
- L'app usa `Cormorant Garamond` per L'Ombra e `Inter` per tutta la UI.

## Componenti

- `src/components/ui/Button.tsx`: varianti `primary`, `ghost`, `whisper`.
- `src/components/ui/Input.tsx`: input utente con stati focus ed errore.
- `src/components/ui/TypingText.tsx`: typing effect con supporto `prefers-reduced-motion`.
- `src/components/ui/ProgressBar.tsx`: progress bar segmentata accessibile.
- `src/components/experience/MissionCard.tsx`: composizione standard della missione.

## Motion

- Le costanti sono in `src/lib/motion.ts`.
- Nessuna transizione ordinaria scende sotto `300ms`, tranne il press del bottone.
- Con `prefers-reduced-motion: reduce` il typing effect si disattiva e i respiri vengono fermati.

## Regole chiave

- Nessun nero piatto come fill di contenuto.
- Tutti i testi di L'Ombra sono serif italic.
- Nessun radius sopra `2px`, salvo la progress bar.
- Nessun toast classico nel frontend utente: gli errori parlano in-character.
