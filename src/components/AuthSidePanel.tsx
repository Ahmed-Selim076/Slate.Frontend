import { Link } from '@tanstack/react-router'
import { useState } from 'react'

const SHAPES = [
  'M20 150 C 60 40, 120 40, 150 100 S 240 180, 280 60',
  'M20 60 C 70 170, 140 170, 160 100 S 250 20, 300 130',
  'M20 100 C 80 20, 100 180, 160 100 S 220 20, 300 100',
]

export default function AuthSidePanel({
  heading,
  subheading,
}: {
  heading: string
  subheading: string
}) {
  const [shapeIndex, setShapeIndex] = useState(0)

  return (
    <div className="hidden md:flex flex-col justify-between bg-[var(--color-accent)] p-12 relative overflow-hidden">
      <div className="absolute inset-0 dot-grid-bg opacity-20" />

      <Link to="/" className="text-[#082A20] font-semibold text-lg relative w-fit hover:opacity-80 transition-opacity">
        Slate
      </Link>

      <div className="relative">
        <svg viewBox="0 0 320 200" className="w-full h-auto mb-8" fill="none">
          <path
            key={shapeIndex}
            d={SHAPES[shapeIndex]}
            stroke="#082A20"
            strokeWidth="4"
            strokeLinecap="round"
            className="doodle-loop"
            onAnimationIteration={() => setShapeIndex((i) => (i + 1) % SHAPES.length)}
          />
        </svg>
        <p className="text-[#082A20] text-xl font-medium leading-snug relative">{heading}</p>
        <p className="text-[#0C3A2B] text-sm mt-3 relative opacity-80">{subheading}</p>
      </div>

      <div />
    </div>
  )
}
