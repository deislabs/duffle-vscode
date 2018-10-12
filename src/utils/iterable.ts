export function iter<T>(i: Iterable<T>): Enumerable<T> {
    return new EnumerableImpl(i);
}

export interface Enumerable<T> extends Iterable<T> {
    first(predicate: (t: T) => boolean): T | null;
    map<U>(fn: (t: T) => U): Enumerable<U>;
    collect<U>(fn: (t: T) => Iterable<U>): Enumerable<U>;
    filter(predicate: (t: T) => boolean): Enumerable<T>;
    groupBy<K>(selector: (t: T) => K): Enumerable<Group<K, T>>;
    toArray(): T[];
}

export interface Group<K, T> {
    readonly key: K;
    readonly values: T[];
}

class EnumerableImpl<T> implements Enumerable<T> {
    constructor(private readonly source: Iterable<T>) { }

    [Symbol.iterator](): Iterator<T> {
        return this.source[Symbol.iterator]();
    }

    first(predicate: (t: T) => boolean): T | null {
        for (const item of this.source) {
            if (predicate(item)) {
                return item;
            }
        }
        return null;
    }

    map<U>(fn: (t: T) => U): Enumerable<U> {
        return iter(this.mapImpl<U>(fn));
    }

    *mapImpl<U>(fn: (t: T) => U): IterableIterator<U> {
        for (const item of this.source) {
            yield fn(item);
        }
    }

    collect<U>(fn: (t: T) => Iterable<U>): Enumerable<U> {
        return iter(this.collectImpl<U>(fn));
    }

    *collectImpl<U>(fn: (t: T) => Iterable<U>): IterableIterator<U> {
        for (const item of this.source) {
            yield* fn(item);
        }
    }

    filter(predicate: (t: T) => boolean): Enumerable<T> {
        return iter(this.filterImpl(predicate));
    }

    *filterImpl(predicate: (t: T) => boolean): IterableIterator<T> {
        for (const item of this.source) {
            if (predicate(item)) {
                yield item;
            }
        }
    }

    // This is very inefficient for large collections (or, rather, for large
    // numbers of groups) - deal to it if that becomes a problem
    groupBy<K>(selector: (t: T) => K): Enumerable<Group<K, T>> {
        const groups: Group<K, T>[] = [];
        for (const item of this.source) {
            const key = selector(item);
            const group = groups.find((g) => g.key === key);
            if (group) {
                group.values.push(item);
            } else {
                groups.push({ key: key, values: [item] });
            }
        }
        return iter(groups);
    }

    toArray(): T[] {
        return new Array<T>(...this.source);
    }
}
