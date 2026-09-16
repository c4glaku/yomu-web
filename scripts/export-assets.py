#!/usr/bin/env python3
"""Adapt the neighboring Swift app's original story and licensed dictionary.

Common entries load once; uncommon entries are fetched in small, local shards.
All generated dictionary data remains CC BY-SA 4.0. No network is used here.
"""
import argparse
import gzip
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source', nargs='?', default=str(ROOT.parent / 'JapeneseApp'))
source = Path(parser.parse_args().source)
out = ROOT / 'public/dictionary'
out.mkdir(parents=True, exist_ok=True)

def write(name, data):
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    (out / name).write_bytes(gzip.compress(payload, mtime=0))

def shard(text):
    return ord(text[0]) % 64

db = sqlite3.connect(f'file:{source}/Sources/YomuCore/Resources/Dictionary.sqlite?mode=ro', uri=True)
common, rare = [], [[] for _ in range(64)]
count = 0
for row in db.execute('SELECT id,word,reading,meanings,pos,common FROM entries ORDER BY common DESC,id'):
    entry = [row[0], row[1], row[2], json.loads(row[3]), row[4], row[5]]
    count += 1
    if row[5]:
        common.append(entry)
    else:
        for bucket in {shard(row[1]), shard(row[2])}:
            rare[bucket].append(entry)
write('common.json.gz', common)
for i, entries in enumerate(rare):
    write(f'rare-{i}.json.gz', entries)
kanji = [[r[0], *[json.loads(v) for v in r[1:]]] for r in db.execute('SELECT * FROM kanji')]
write('kanji.json.gz', kanji)
metadata = dict(db.execute('SELECT * FROM metadata'))
metadata.update(entries=count, common=len(common), kanji=len(kanji))
(out / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
license_text = (source / 'Sources/YomuCore/Resources/Dictionary-LICENSE.txt').read_text()
license_text += '\nWeb adaptation: scripts/export-assets.py exports all entries as compressed JSON,\nwith common entries and uncommon entries grouped into lookup shards.\nAll meanings and readings are preserved. These JSON adaptations remain CC BY-SA 4.0.\n'
(out / 'LICENSE.txt').write_text(license_text)

swift = (source / 'Sources/YomuCore/SampleBook.swift').read_text()
chapters = re.findall(r'\("([^"\n]+)", \[\s*((?:"[^"\n]+"[,]?\s*)+)\]\)', swift)
pages = []
for chapter, content in chapters:
    for raw in re.findall(r'"([^"\n]+)"', content):
        pages.append({'text': raw.replace('\\n', '\n'), 'chapter': chapter})
assert len(pages) == 6, 'Expected the six-page original story'
(ROOT / 'src/sample.ts').write_text(
    "import type { Book } from './types'\n\nconst pages = " + json.dumps(pages, ensure_ascii=False, indent=2) +
    "\n\nexport function sampleBook(): Book {\n  return { id: 'yomu-starter', title: '小さな一歩', author: 'A small step · A Yomu original', format: 'sample', pages, position: 0, readPages: [], completed: false, addedAt: new Date().toISOString(), tone: 0, highlights: [] }\n}\n")
print(f'Exported {count:,} word/reading pairs, {len(kanji):,} kanji, and {len(pages)} story pages.')
print(f'Compressed dictionary: {sum(p.stat().st_size for p in out.glob("*.gz")) / 1024**2:.1f} MB')
