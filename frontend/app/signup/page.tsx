'use client'

import React from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Hexagon } from 'lucide-react'
import { motion } from 'motion/react'

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 selection:bg-primary/30">
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity">
        <Hexagon className="w-6 h-6 text-primary fill-primary/20" />
        <span>PipelineIQ</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Join PipelineIQ to start resolving CI/CD failures instantly.
            </p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
              className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-4 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <GithubIcon className="w-5 h-5" />
              Continue with GitHub
            </button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Work Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="w-full bg-[#0A0A0B] border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
              <button type="submit" className="w-full flex items-center justify-center bg-[#0A0A0B] hover:bg-[#141416] border border-border/50 text-foreground py-2.5 px-4 rounded-lg text-sm font-medium transition-colors">
                Continue with Email
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed">
            By clicking continue, you agree to our{' '}
            <Link href="#" className="underline hover:text-foreground">Terms of Service</Link>{' '}
            and{' '}
            <Link href="#" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
        
        <div className="text-center mt-6 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
