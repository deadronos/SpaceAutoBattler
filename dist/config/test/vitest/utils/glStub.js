export function makeGLStub() {
    let next = 1;
    const created = [];
    return {
        createTexture() { const id = { __tex: next++ }; created.push(id); return id; },
        deleteTexture(t) { const i = created.indexOf(t); if (i >= 0)
            created.splice(i, 1); },
        getCreatedCount() { return created.length; },
        getCreatedList() { return created.slice(); }
    };
}
export function makeSpriteFactory() {
    let next = 1;
    const created = [];
    return {
        create() { const id = { __sprite: next++ }; created.push(id); return id; },
        delete(s) { const i = created.indexOf(s); if (i >= 0)
            created.splice(i, 1); },
        getCount() { return created.length; }
    };
}
