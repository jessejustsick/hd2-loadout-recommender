import { Check } from 'lucide-react'
import styles from './ProgressStepper.module.css'

interface Props {
  totalSteps: number
  currentStep: number
  completedSteps: number
}

export default function ProgressStepper({ totalSteps, currentStep, completedSteps }: Props) {
  return (
    <div className={styles.stepper} role="list" aria-label="Progress">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isCompleted = step <= completedSteps
        const isActive = step === currentStep

        return (
          <div key={step} className={styles.stepWrapper} role="listitem">
            <div
              className={`${styles.step} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}
              aria-label={`Step ${step}${isCompleted ? ', completed' : isActive ? ', current' : ''}`}
            >
              {isCompleted ? <Check size={12} strokeWidth={3} /> : step}
            </div>
            {i < totalSteps - 1 && (
              <div className={`${styles.connector} ${isCompleted ? styles.connectorFilled : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
