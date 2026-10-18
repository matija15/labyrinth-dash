import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen } from './src/components/GameScreen';
import { LevelEditor } from './src/components/LevelEditor';
import { LevelSelect } from './src/components/LevelSelect';
import { SkinPicker } from './src/components/SkinPicker';
import { COLORS } from './src/components/renderer';
import { emptySave } from './src/engine/save';
import { loadSave, resetSave, writeSave } from './src/engine/storage';
import { DEV_TOOLS, packLevels, RELEASE_LEVELS, type LevelPack } from './src/levels';
import type { LevelDef, SaveData } from './src/types';

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [skins, setSkins] = useState(false);
  const [pack, setPack] = useState<LevelPack>('release');
  const [playtest, setPlaytest] = useState<{ level: LevelDef; run: number } | null>(null);
  const [deathMarks, setDeathMarks] = useState<[number, number][]>([]);

  useEffect(() => {
    loadSave().then(setSave);
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
                onClearDeathMarks={() => setDeathMarks([])}
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
                    onDeath={(x, y) => setDeathMarks((m) => [...m.slice(-499), [x, y]])}
                  />
                </View>
              )}
            </>
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
