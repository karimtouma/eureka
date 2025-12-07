"use client";

import Link from "next/link";
import { Database, Settings, TrendingUp, ArrowRight } from "lucide-react";
import { PageTransition, StaggerContainer, StaggerItem, SlideUp } from "@/components/motion";

export default function Home() {
  return (
    <PageTransition>
    <div className="min-h-screen">
      {/* Hero Section */}
        <section className="relative px-6 py-20 lg:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-6">
              <SlideUp delay={0}>
            <p className="text-caption uppercase tracking-widest text-text-muted">
              Symbolic Regression
            </p>
              </SlideUp>

              <SlideUp delay={0.1}>
            <h1 className="text-display">
              Discover equations
              <br />
              <span className="text-accent">hidden in your data</span>
            </h1>
              </SlideUp>

              <SlideUp delay={0.2}>
            <p className="text-body text-text-secondary max-w-xl mx-auto">
              Eureka uses evolutionary algorithms to find mathematical expressions
              that describe your data. No assumptions, no black boxes—just pure equations.
            </p>
              </SlideUp>

              <SlideUp delay={0.3}>
            <div className="flex items-center justify-center gap-3 pt-4">
              <Link href="/data" className="btn-primary">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View on GitHub
              </a>
            </div>
              </SlideUp>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
            <StaggerContainer className="grid md:grid-cols-3 gap-4">
              <StaggerItem>
            <FeatureCard
              href="/data"
              icon={<Database className="w-5 h-5" />}
              number="01"
              title="Data"
              description="Import your data from CSV or enter it directly. Configure features and target columns."
            />
              </StaggerItem>
              <StaggerItem>
            <FeatureCard
              href="/functions"
              icon={<Settings className="w-5 h-5" />}
              number="02"
              title="Functions"
              description="Select mathematical building blocks and configure evolution parameters."
            />
              </StaggerItem>
              <StaggerItem>
            <FeatureCard
              href="/results"
              icon={<TrendingUp className="w-5 h-5" />}
              number="03"
              title="Results"
              description="Watch equations evolve in real-time. Explore the accuracy vs complexity trade-off."
            />
              </StaggerItem>
            </StaggerContainer>
        </div>
      </section>

      {/* How it Works */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-3xl mx-auto">
            <SlideUp>
          <h2 className="text-headline text-center mb-12">How it works</h2>
            </SlideUp>

            <StaggerContainer className="space-y-8">
              <StaggerItem>
            <Step
              number="1"
              title="Load your data"
              description="Upload a CSV file or paste data directly. Select input variables (X) and output (Y)."
            />
              </StaggerItem>
              <StaggerItem>
            <Step
              number="2"
              title="Configure the search"
              description="Choose mathematical operations and functions. Set population size and generations."
            />
              </StaggerItem>
              <StaggerItem>
            <Step
              number="3"
              title="Evolve solutions"
              description="Genetic programming evolves equations, selecting the fittest and combining them."
            />
              </StaggerItem>
              <StaggerItem>
            <Step
              number="4"
              title="Analyze results"
              description="Review best equations on the Pareto front of accuracy vs complexity."
            />
              </StaggerItem>
            </StaggerContainer>
        </div>
      </section>
    </div>
    </PageTransition>
  );
}

function FeatureCard({
  href,
  icon,
  number,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group p-6 card-interactive flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/30 transition-all">
          {icon}
        </div>
        <span className="text-caption font-mono text-text-muted">{number}</span>
      </div>
      <div>
        <h3 className="text-title mb-1">{title}</h3>
        <p className="text-body text-text-muted">{description}</p>
      </div>
      <div className="mt-auto pt-2 flex items-center gap-1.5 text-caption text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-text-primary flex items-center justify-center text-white text-sm font-mono font-medium">
        {number}
      </div>
      <div className="pt-0.5">
        <h3 className="text-title mb-1">{title}</h3>
        <p className="text-body text-text-muted">{description}</p>
      </div>
    </div>
  );
}
