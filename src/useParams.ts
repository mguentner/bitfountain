import { useMemo } from "react";

export const useParams = (key: string) => {
    const search = window.location.search;
    const value = useMemo(() => {
        const params = new URLSearchParams(search);
        return params.get(key);
    }, [key, search])
    return value;
}
