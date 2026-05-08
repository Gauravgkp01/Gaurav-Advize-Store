import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute left-0 right-0 top-1/2 h-1 bg-muted rounded-full -z-10 transform -translate-y-1/2" />
        
        {/* Progress Line */}
        <div 
          className="absolute left-0 top-1/2 h-1 bg-primary rounded-full -z-10 transform -translate-y-1/2 transition-all duration-500 ease-in-out" 
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />

        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div key={stepNumber} className="flex flex-col items-center">
              <div 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-300
                  ${isCompleted ? 'bg-primary text-white' : 
                    isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' : 
                    'bg-background border-2 border-muted text-muted-foreground'}
                `}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
