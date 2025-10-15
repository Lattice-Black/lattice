export default function Error({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}): import("react/jsx-runtime").JSX.Element;
