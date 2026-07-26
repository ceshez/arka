import { motion, useReducedMotion } from 'framer-motion'

export function SuccessCheck({ label = 'Confirmed' }: { label?: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="mx-auto grid size-24 place-items-center rounded-full border border-[#e9b213] bg-[#fff1c9] text-[#b87900] shadow-[0_8px_18px_rgba(125,87,0,0.10)]"
      initial={reduceMotion ? false : { scale: 0.72, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 330, damping: 20 }}
      role="img"
      aria-label={label}
    >
      <svg className="size-12" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <motion.path
          d="M12 27.5 22 37l19-24"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.42, delay: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
        />
      </svg>
    </motion.div>
  )
}

