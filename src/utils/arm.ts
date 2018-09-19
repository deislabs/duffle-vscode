export function isParameterDefinition(obj: any): boolean {
    if (obj.type) {
        return true;
    }
    return false;
}
