#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
const repoRoot = process.cwd();
const snapshotPath = path.join(repoRoot, 'docs', 'memory_snapshot.json');
const generatorCmd = 'npm run generate-memory-index';
async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}
async function main() {
    console.log('Interactive memory node adder');
    const name = (await ask('Node name (short): ')).trim();
    if (!name) {
        console.error('Name required');
        process.exit(1);
    }
    const source = (await ask('Source (relative path): ')).trim();
    if (!source) {
        console.error('Source required');
        process.exit(1);
    }
    console.log('Enter summary (end with an empty line):');
    const lines = [];
    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const line = await ask('> ');
        if (!line.trim())
            break;
        lines.push(line);
    }
    const summary = lines.join(' ').trim();
    const node = { name, source, summary };
    if (!(await fileExists(snapshotPath))) {
        console.log('Snapshot not found, creating new snapshot with this node.');
        const payload = { meta: { generated: new Date().toISOString(), source: 'interactive-helper' }, nodes: [node] };
        await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
        await fs.writeFile(snapshotPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
        console.log(`Wrote ${snapshotPath}`);
    }
    else {
        const raw = await fs.readFile(snapshotPath, 'utf8');
        let doc;
        try {
            doc = JSON.parse(raw);
        }
        catch (err) {
            console.error('Failed to parse snapshot JSON:', err);
            process.exit(1);
        }
        doc.meta = doc.meta || {};
        doc.meta.updated = new Date().toISOString();
        doc.nodes = doc.nodes || [];
        doc.nodes.push(node);
        await fs.writeFile(snapshotPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
        console.log(`Appended node to ${snapshotPath}`);
    }
    // run generator
    console.log('Running generator...');
    const { spawn } = await import('child_process');
    const proc = spawn('npm', ['run', 'generate-memory-index'], { stdio: 'inherit', shell: true });
    proc.on('exit', (code) => process.exit(code ?? 0));
}
main().catch((err) => { console.error(err); process.exit(1); });
