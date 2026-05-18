import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressStepper from '@/components/ProgressStepper'
import FactionSelector from '@/components/FactionSelector'
import DifficultySelector from '@/components/DifficultySelector'
import ChipSelector from '@/components/ChipSelector'
import InputGroup from '@/components/InputGroup'
import { planetService } from '@/services/planets'
import { catalogService } from '@/services/catalog'
import type { FactionId, Planet, MissionParams, CampaignMode } from '@/types'
import styles from './InputScreen.module.css'

// ---- State ----

interface InputState {
  faction: FactionId | null
  difficulty: number | null
  planet: string | null
  missionType: string | null
  modifiers: string[]
  operationModifiers: string[]
}

type Action =
  | { type: 'SET_FACTION'; faction: FactionId }
  | { type: 'SET_DIFFICULTY'; difficulty: number }
  | { type: 'SET_PLANET'; planet: string }
  | { type: 'SET_MISSION_TYPE'; missionType: string }
  | { type: 'SET_MODIFIERS'; modifiers: string[] }
  | { type: 'SET_OPERATION_MODIFIERS'; modifiers: string[] }
  | { type: 'RESET' }

function reducer(state: InputState, action: Action): InputState {
  switch (action.type) {
    case 'SET_FACTION':
      return { faction: action.faction, difficulty: null, planet: null, missionType: null, modifiers: [], operationModifiers: [] }
    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.difficulty, planet: null, missionType: null, modifiers: [], operationModifiers: [] }
    case 'SET_PLANET':
      return { ...state, planet: action.planet, missionType: null, modifiers: [], operationModifiers: [] }
    case 'SET_MISSION_TYPE':
      return { ...state, missionType: action.missionType }
    case 'SET_MODIFIERS':
      return { ...state, modifiers: action.modifiers }
    case 'SET_OPERATION_MODIFIERS':
      return { ...state, operationModifiers: action.modifiers }
    case 'RESET':
      return { faction: null, difficulty: null, planet: null, missionType: null, modifiers: [], operationModifiers: [] }
  }
}

const INITIAL: InputState = { faction: null, difficulty: null, planet: null, missionType: null, modifiers: [], operationModifiers: [] }

// ---- Planet loading ----

type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'error-second'

interface PlanetState {
  status: LoadState
  planets: Planet[]
  retries: number
}

// ---- Component ----

interface Props {
  initialState?: InputState
  onReset?: () => void
}

export default function InputScreen({ initialState = INITIAL, onReset }: Props) {
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [planetState, setPlanetState] = useState<PlanetState>({ status: 'idle', planets: [], retries: 0 })
  const [useFallback, setUseFallback] = useState(false)
  const [showOpModifiers, setShowOpModifiers] = useState(false)
  const [campaignMode, setCampaignMode] = useState<CampaignMode | null>(null)

  const { faction, difficulty, planet, missionType, modifiers, operationModifiers } = state

  const totalSteps = 4
  const completedSteps =
    !faction ? 0
    : !difficulty ? 1
    : !planet ? 2
    : !missionType ? 3
    : 4
  const currentStep = Math.min(completedSteps + 1, totalSteps)

  // Fetch planets when faction changes
  useEffect(() => {
    if (!faction) return
    setPlanetState({ status: 'loading', planets: [], retries: 0 })

    planetService.getPlanets(faction)
      .then(data => {
        if (data.length === 0) {
          setUseFallback(true)
          setPlanetState({ status: 'success', planets: [], retries: 0 })
        } else {
          setPlanetState({ status: 'success', planets: data, retries: 0 })
        }
      })
      .catch(() => setPlanetState(s => ({ ...s, status: 'error', retries: s.retries + 1 })))
  }, [faction])

  function retryPlanets() {
    if (!faction) return
    setPlanetState(s => ({ ...s, status: 'loading' }))
    planetService.getPlanets(faction)
      .then(data => setPlanetState({ status: 'success', planets: data, retries: 0 }))
      .catch(() =>
        setPlanetState(s => {
          const retries = s.retries + 1
          return { ...s, status: retries >= 2 ? 'error-second' : 'error', retries }
        })
      )
  }

  function handleUseFallback() {
    setUseFallback(true)
    setPlanetState(s => ({ ...s, status: 'success', planets: [] }))
  }

  // Auto-generate when all inputs complete (both live and fallback paths)
  useEffect(() => {
    if (!faction || !difficulty || !planet || !missionType) return
    const params: MissionParams = { faction, difficulty, planet, missionType, modifiers: [...modifiers, ...operationModifiers] }
    navigate('/recommend/results', { state: { params, inputState: state } })
  }, [missionType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Planets as chip options (infer modifiers from selected planet)
  const planetOptions = planetState.planets.map(p => ({ id: p.name, label: p.name }))

  // Derive selected planet data directly from already-loaded planet list
  const selectedPlanetData = (planet && !useFallback)
    ? (planetState.planets.find(p => p.name === planet) ?? null)
    : null
  const selectedPlanetModifiers = selectedPlanetData?.modifiers ?? null
  const selectedPlanetBiome = selectedPlanetData?.biome ?? null

  // Mission types filtered by faction + difficulty + campaign mode + planet modifiers + biome
  const missionTypeOptions = catalogService.getMissionTypes()
    .filter(mt => {
      if (!faction) return false
      const factionOk = mt.availability.factions.includes(faction)
      const diffOk = !difficulty || mt.availability.difficulties.includes(difficulty)
      if (!factionOk || !diffOk) return false
      if (campaignMode && !mt.modes.includes(campaignMode)) return false
      if (mt.requiredModifiers && selectedPlanetModifiers !== null) {
        if (!mt.requiredModifiers.some(req => selectedPlanetModifiers.includes(req))) return false
      }
      if (mt.requiredBiomes && selectedPlanetBiome !== null) {
        if (!mt.requiredBiomes.includes(selectedPlanetBiome)) return false
      }
      return true
    })
    .map(mt => ({ id: mt.id, label: mt.name }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Infer modifiers from planet selection (live data path)
  useEffect(() => {
    if (!planet || useFallback) return
    const found = planetState.planets.find(p => p.name === planet)
    if (found) dispatch({ type: 'SET_MODIFIERS', modifiers: found.modifiers })
  }, [planet, useFallback, planetState.planets])

  // Fetch campaign mode for selected planet to narrow mission type list
  useEffect(() => {
    if (!planet || planet === '__manual') {
      setCampaignMode(null)
      return
    }
    planetService.getCampaignType(planet)
      .then(mode => setCampaignMode(mode))
      .catch(() => setCampaignMode(null))
  }, [planet])

  function handleReset() {
    dispatch({ type: 'RESET' })
    setPlanetState({ status: 'idle', planets: [], retries: 0 })
    setUseFallback(false)
    setShowOpModifiers(false)
    setCampaignMode(null)
    onReset?.()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <img src="/hd2-logo.svg" alt="Helldivers 2" className={styles.gameLogo} />
        <h1 className={styles.title}>Build Your Loadout</h1>
        <ProgressStepper
          totalSteps={totalSteps}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      </div>

      {/* Step 1 — Faction (always visible) */}
      <div className={styles.firstGroup}>
        <p className={styles.groupLabel}>Faction</p>
        <FactionSelector value={faction} onChange={f => dispatch({ type: 'SET_FACTION', faction: f })} />
      </div>

      {/* Step 2 — Difficulty */}
      <InputGroup label="Difficulty" visible={faction !== null}>
        <DifficultySelector value={difficulty} onChange={d => dispatch({ type: 'SET_DIFFICULTY', difficulty: d })} />
      </InputGroup>

      {/* Step 3 — Planet */}
      <InputGroup label="Planet" visible={difficulty !== null}>
        {planetState.status === 'loading' && (
          <div className={styles.skeleton}>
            {Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeletonChip} />)}
          </div>
        )}

        {(planetState.status === 'error' || planetState.status === 'error-second') && (
          <div className={styles.error}>
            <p className={styles.errorText}>Couldn't load planet data.</p>
            <div className={styles.errorActions}>
              <button className={styles.retryBtn} onClick={retryPlanets}>Try again</button>
              {planetState.status === 'error-second' && (
                <button className={styles.fallbackBtn} onClick={handleUseFallback}>
                  Continue without planet data
                </button>
              )}
            </div>
          </div>
        )}

        {planetState.status === 'success' && !useFallback && planetState.planets.length > 0 && (
          <ChipSelector
            options={planetOptions}
            value={planet}
            onChange={p => dispatch({ type: 'SET_PLANET', planet: p })}
          />
        )}

        {planetState.status === 'success' && useFallback && (
          <ChipSelector
            options={[{ id: '__manual', label: 'Manual (no planet data)' }]}
            value={planet}
            onChange={() => dispatch({ type: 'SET_PLANET', planet: '__manual' })}
          />
        )}
      </InputGroup>

      {/* Step 4 — Operation Modifiers (fallback only, optional) */}
      {useFallback && (
        <InputGroup label="Operation Modifiers" visible={planet !== null}>
          <p className={styles.fallbackNote}>Optional — select any active operation modifiers.</p>
          <ChipSelector
            multi
            options={catalogService.getOperationModifiers(faction ?? undefined).map(m => ({ id: m.id, label: m.name })).sort((a, b) => a.label.localeCompare(b.label))}
            value={operationModifiers}
            onChange={ids => dispatch({ type: 'SET_OPERATION_MODIFIERS', modifiers: ids })}
          />
        </InputGroup>
      )}

      {/* Mission Conditions — detected env modifiers + optional operation modifiers (live path only) */}
      {!useFallback && (
        <InputGroup label="Mission Conditions" visible={planet !== null && planet !== '__manual'}>
          {modifiers.length > 0 && (
            <div className={styles.detectedBlock}>
              <p className={styles.detectedLabel}>Detected on {planet}</p>
              <div className={styles.detectedChips}>
                {modifiers.map(id => {
                  const mod = catalogService.getModifiers().find(m => m.id === id)
                  return mod ? <span key={id} className={styles.detectedChip}>{mod.name}</span> : null
                })}
              </div>
            </div>
          )}
          <button
            className={styles.opModToggle}
            onClick={() => setShowOpModifiers(s => !s)}
          >
            {showOpModifiers ? '− Hide operation modifiers' : '+ Add operation modifiers'}
          </button>
          {showOpModifiers && (
            <ChipSelector
              multi
              options={catalogService.getOperationModifiers(faction ?? undefined).map(m => ({ id: m.id, label: m.name })).sort((a, b) => a.label.localeCompare(b.label))}
              value={operationModifiers}
              onChange={ids => dispatch({ type: 'SET_OPERATION_MODIFIERS', modifiers: ids })}
            />
          )}
        </InputGroup>
      )}

      {/* Step 4 (live) / Step 5 (fallback) — Mission Type */}
      <InputGroup label="Mission Type" visible={planet !== null}>
        {missionTypeOptions.length > 0 ? (
          <ChipSelector
            options={missionTypeOptions}
            value={missionType}
            onChange={mt => dispatch({ type: 'SET_MISSION_TYPE', missionType: mt })}
          />
        ) : (
          <p className={styles.emptyText}>No mission types available for this selection.</p>
        )}
      </InputGroup>


      {faction && (
        <button className={styles.resetBtn} onClick={handleReset}>Start over</button>
      )}
    </div>
  )
}
