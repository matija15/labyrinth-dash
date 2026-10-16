import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen } from './src/components/GameScreen';
import { LevelSelect } from './src/components/LevelSelect';
import { COLORS } from './src/components/renderer';
import { emptySave } from './src/engine/save';
import { loadSave, resetSave, writeSave } from './src/engine/storage';
import { LEVELS } from './src/levels';
import type { SaveData } from './src/types';

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);

  useEffect(() => {
    loadSave().then(setSave);
  }, []);

  const onSave = useCallback((next: SaveData) => {
    setSave(next);
    writeSave(next);
  }, []);

  const index = LEVELS.findIndex((l) => l.id === levelId);
  const level = index >= 0 ? LEVELS[index] : null;

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
              hasNext={index < LEVELS.length - 1}
              onSave={onSave}
              onExit={() => setLevelId(null)}
              onNext={() => setLevelId(LEVELS[index + 1].id)}
            />
          ) : save ? (
            <LevelSelect
              levels={LEVELS}
              save={save}
              onPlay={setLevelId}
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

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: COLORS.bg } });
