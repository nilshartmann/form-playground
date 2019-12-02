import toPath from 'lodash/toPath';

export function getValueFromObject(pathString: string, object: any, strict:boolean=true): any {
    const path: string[] = toPath(pathString);
    let value = object[path[0]];
    for (let i = 1; i < path.length; i++) {
        if (!strict && value === undefined) {
            return undefined;
        }
        value = value[path[i]];
    }
    return value;
}
export function setValueOnObject(pathString: string, object: any, newValue: any) {
    const path: string[] = toPath(pathString);
    let parent = object;
    for (let i = 0; i < path.length-1; i++) {
        parent = parent[path[i]];
    }
    parent[path.pop() as any] = newValue;
}