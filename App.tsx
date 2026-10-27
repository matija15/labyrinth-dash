import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen } from './src/components/GameScreen';
import { LevelEditor } from './src/components/LevelEditor';
import { LevelSelect } from './src/components/LevelSelect';
import { SkinPicker } from './src/components/SkinPicker';
import { Storybook } from './src/components/Storybook';
import { COLORS } from './src/components/renderer';
import { emptySave, pagesFound } from './src/engine/save';
import { loadDeathMarks, loadSave, resetSave, writeDeathMarks, writeSave, type DeathMarks } from './src/engine/storage';
import { DEV_TOOLS, packLevels, RELEASE_LEVELS, type LevelPack } from './src/levels';
import type { LevelDef, SaveData } from './src/types';

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [skins, setSkins] = useState(false);
  const [pack, setPack] = useState<LevelPack>('release');
  const [playtest, setPlaytest] = useState<{ level: LevelDef; run: number } | null>(null);
  const [story, setStory] = useState(false);
  const [deathMarks, setDeathMarks] = useState<DeathMarks>({});

  useEffect(() => {
    loadSave().then(setSave);
    if (DEV_TOOLS) loadDeathMarks().then((m) => setDeathMarks((cur) => ({ ...m, ...cur })));
  }, []);

  const updateDeathMarks = useCallback((fn: (m: DeathMarks) => DeathMarks) => {
    setDeathMarks((m) => {
      const next = fn(m);
      void writeDeathMarks(next);
      return next;
    });
  }, []);

  const onSave = useCallback((next: SaveData) => {
    setSave(next);
    writeSave(next);
  }, []);

  const levels = packLevels(pack);
  const index = levels.findIndex((l) => l.id === levelId);
  const level = index >= 0 ? levels[index] : null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar hidden style="light" />
        <View style={styles.root}>
          {save && level ? (
            <GameScreen
              key={level.id}
              level={level}
              save={save}
              hasNext={index < levels.length - 1}
              onSave={onSave}
              onExit={() => setLevelId(null)}
              onNext={() => setLevelId(levels[index + 1].id)}
            />
          ) : save && editing && DEV_TOOLS ? (
            <>
              <LevelEditor
                active={!playtest}
                onPlaytest={(l) => setPlaytest((p) => ({ level: l, run: (p?.run ?? 0) + 1 }))}
                onExit={() => setEditing(false)}
                deathMarks={deathMarks}
                onClearDeathMarks={(id) => updateDeathMarks(({ [id]: _, ...rest }) => rest)}
              />
              {playtest && (
                <View style={StyleSheet.absoluteFill}>
                  <GameScreen
                    key={playtest.run}
                    level={playtest.level}
                    save={save}
                    hasNext={false}
                    playtest
                    onSave={noop}
                    onExit={() => setPlaytest(null)}
                    onNext={noop}
                    onDeath={(x, y) => {
                      const id = playtest.level.id;
                      updateDeathMarks((m) => ({ ...m, [id]: [...(m[id] ?? []).slice(-1999), [x, y]] }));
                    }}
                  />
                </View>
              )}
            </>
          ) : save && story ? (
            <Storybook found={pagesFound(save, RELEASE_IDS)} onBack={() => setStory(false)} />
          ) : save && skins ? (
            <SkinPicker save={save} releaseIds={RELEASE_IDS} onSave={onSave} onBack={() => setSkins(false)} />
          ) : save ? (
            <LevelSelect
              levels={levels}
              save={save}
              devTools={DEV_TOOLS}
              pack={pack}
              onPack={setPack}
              onPlay={setLevelId}
              onEditor={() => setEditing(true)}
              onSkins={() => setSkins(true)}
              onControls={(controls) => onSave({ ...save, controls })}
              onAudio={(audio) => onSave({ ...save, audio })}
              onAssist={(assist) => onSave({ ...save, assist })}
              onGhost={(ghost) => onSave({ ...save, ghost })}
              onHaptics={(haptics) => onSave({ ...save, haptics })}
              onStorybook={() => setStory(true)}
              pagesFound={pagesFound(save, RELEASE_IDS)}
              onReset={() => {
                resetSave();
                setSave(emptySave());
              }}
            />
          ) : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const noop = () => {};
const RELEASE_IDS = RELEASE_LEVELS.map((l) => l.id);

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: COLORS.bg } });
