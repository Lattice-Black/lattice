export default function GlobalError({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}): import("react/jsx-runtime").JSX.Element;
