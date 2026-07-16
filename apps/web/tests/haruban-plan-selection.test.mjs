import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const harubanSource = readFileSync(
  new URL('../src/components/HarubanChat.tsx', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('checking a Haruban web recommendation immediately adds it to the shared plan', () => {
  assert.match(
    harubanSource,
    /const addCandidate = \(candidate: HarubanWebPlaceCandidate\) => \{[\s\S]*onAddPlanItem\(planItemFromWebCandidate\(candidate\)\)/,
  );
  assert.match(harubanSource, /onChange=\{\(\) => addCandidate\(candidate\)\}/);
  assert.doesNotMatch(harubanSource, /const \[selectedIds, setSelectedIds\]/);
  assert.doesNotMatch(harubanSource, /const \[addedIds, setAddedIds\]/);
  assert.match(harubanSource, /const alreadyAdded = planIds\.has\(`web-\$\{candidate\.id\}`\)/);
  assert.doesNotMatch(harubanSource, /선택한 \{selectedIds\.length\}곳을 플랜에 담기/);
});

test('Haruban writes into the same selectedPlanItems state used by My Travel Plan', () => {
  assert.match(appSource, /selectedPlanItems=\{state\.selectedPlanItems \|\| \[\]\}/);
  assert.match(appSource, /onAddPlanItem=\{handleAddCustomPlanItem\}/);
  assert.match(
    appSource,
    /const handleAddCustomPlanItem = \(item: TravelPlanItem\) => \{[\s\S]*selectedPlanItems: schedulePlanItemsForWeather\(prev\.info, \[\.\.\.current, item\]\)/,
  );
});
