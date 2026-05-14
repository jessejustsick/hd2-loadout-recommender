import { Routes, Route } from 'react-router-dom'
import InputScreen from './InputScreen'
import ResultsScreen from './ResultsScreen'

export default function Recommend() {
  return (
    <Routes>
      <Route index element={<InputScreen />} />
      <Route path="results" element={<ResultsScreen />} />
    </Routes>
  )
}
