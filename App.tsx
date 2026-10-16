import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen } from './src/components/GameScreen';
import { LevelEditor } from './src/components/LevelEditor';
import { LevelSelect } from './src/components/LevelSelect';
import { COLORS } from './src/components/renderer';
import { emptySave } from './src/engine/save';
import { loadSave, resetSave, writeSave } from './src/engine/storage';
import { DEV_TOOLS, packLevels, type LevelPack } from './src/levels';
import type { LevelDef, SaveData } from './src/types';

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pack, setPack] = useState<LevelPack>('release');
  const [playtest, setPlaytest] = useState<{ level: LevelDef; run: number } | null>(null);

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
                  />
                </View>
              )}
            </>
          ) : save ? (
            <LevelSelect
              levels={levels}
              save={save}
              devTools={DEV_TOOLS}
              pack={pack}
              onPack={setPack}
              onPlay={setLevelId}
              onEditor={() => setEditing(true)}
              onControls={(controls) => onSave({ ...save, controls })}
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

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: COLORS.bg } });
