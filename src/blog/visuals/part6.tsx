import type { ReactNode } from "react";
import { RoundFlow, SalaryLadder, TierCompare, FrameworkSteps, PrepTimeline, ComparisonTable } from "../../marketing-v2/_blog-infographics";

export const SECTION_VISUALS_6: Record<string, ReactNode> = {
  /* Java Developer: career path framework */
  "java-developer-interview-questions-india-2026||Core Java Topics: The Foundation for All Java Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Core Java Mastery", hint: "OOP, Collections, Generics, Exceptions, JVM internals" },
      { number: "02", label: "Spring Boot Ecosystem", hint: "REST APIs, Spring Data JPA, Security, AOP" },
      { number: "03", label: "Database Depth", hint: "SQL optimization, Hibernate, connection pooling, caching" },
      { number: "04", label: "Microservices Architecture", hint: "Service decomposition, Kafka, circuit breakers, Docker/K8s" },
      { number: "05", label: "System Design & Leadership", hint: "HLD/LLD, distributed systems, mentoring, tech decisions" },
    ]} />
  ),

  /* Data Analyst (Role Guide): salary ladder */
  "data-analyst-interview-questions-india-2026||Data Analyst Salary in India 2026 and Career Paths": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "Fresher Data Analyst (0–1 yr)", min: 4, max: 8 },
      { role: "Data Analyst (1–3 yrs)", min: 7, max: 15 },
      { role: "Senior Data Analyst (3–6 yrs)", min: 12, max: 25 },
      { role: "Lead / Analytics Manager (6–10 yrs)", min: 20, max: 40 },
      { role: "Principal / Head of Analytics (10+ yrs)", min: 30, max: 45, note: "Product companies pay premium" },
    ]} caption="India 2026 — SQL + Python + business domain expertise maximise compensation" />
  ),

  /* Data Analyst (Role Guide): career path framework */
  "data-analyst-interview-questions-india-2026||SQL Interview Questions for Data Analysts in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "SQL Mastery", hint: "Window functions, CTEs, query optimisation, indexing basics" },
      { number: "02", label: "Python + Pandas", hint: "Data wrangling, EDA, visualisation with matplotlib/seaborn" },
      { number: "03", label: "Business Analytics", hint: "KPIs, funnel analysis, cohort analysis, A/B testing basics" },
      { number: "04", label: "BI and Dashboarding", hint: "Tableau, Looker, or Power BI; stakeholder communication" },
      { number: "05", label: "Statistical and ML Fluency", hint: "Regression, hypothesis testing, basic ML model interpretation" },
    ]} />
  ),

  /* Product Manager (Role Guide, first instance): salary ladder */
  "product-manager-interview-questions-india-2026||PM Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "APM / Junior PM (0–2 yrs)", min: 15, max: 30, note: "MBA or SWE background preferred" },
      { role: "PM (2–4 yrs)", min: 25, max: 50 },
      { role: "Senior PM (4–7 yrs)", min: 40, max: 80 },
      { role: "Group PM / Staff PM (7–10 yrs)", min: 60, max: 100 },
      { role: "Director of Product (10+ yrs)", min: 80, max: 120 },
    ]} caption="India 2026 — Flipkart, PhonePe, Swiggy, and FAANG India pay top-of-band" />
  ),

  /* Product Manager (Role Guide, first instance): framework for product design questions */
  "product-manager-interview-questions-india-2026||Product Design Questions: The Core PM Filter": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify the Goal", hint: "Who is the user? What metric defines success? What are constraints?" },
      { number: "02", label: "Define the User", hint: "Segment users, identify pain points, prioritise the primary persona" },
      { number: "03", label: "List Solutions", hint: "Brainstorm 3–5 solutions across impact and feasibility axes" },
      { number: "04", label: "Prioritise and Trade-off", hint: "Pick one solution, justify it vs alternatives using data/logic" },
      { number: "05", label: "Define Success Metrics", hint: "Primary metric + guardrail metrics + how you would measure them" },
    ]} />
  ),

  /* Frontend Developer (Role Guide): salary ladder */
  "frontend-developer-interview-questions-india-2026||Frontend Developer Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior Frontend Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Frontend Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior Frontend Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Staff Frontend Engineer (7+ yrs)", min: 35, max: 55, note: "React Native or performance specialisation adds premium" },
    ]} caption="India 2026 — React + TypeScript + performance engineering commands highest salaries" />
  ),

  /* Frontend Developer (Role Guide): JavaScript deep dive framework */
  "frontend-developer-interview-questions-india-2026||JavaScript Deep Dive: The Foundation of Every Frontend Interview": (
    <FrameworkSteps steps={[
      { number: "01", label: "JavaScript Core", hint: "Closures, prototypes, event loop, async/await, `this` binding" },
      { number: "02", label: "React Depth", hint: "Hooks, reconciliation, memoisation, state management patterns" },
      { number: "03", label: "CSS and Browser Internals", hint: "Box model, flexbox/grid, rendering pipeline, repaints vs reflows" },
      { number: "04", label: "Performance Engineering", hint: "Lazy loading, bundle splitting, Core Web Vitals, LCP/CLS/INP" },
      { number: "05", label: "Frontend System Design", hint: "Component architecture, design systems, micro-frontends, accessibility" },
    ]} />
  ),

  /* ML Engineer (Role Guide): salary ladder */
  "machine-learning-engineer-interview-questions-india-2026||Python Coding and MLE Salary in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Junior MLE (0–2 yrs)", min: 10, max: 22 },
      { role: "MLE (2–4 yrs)", min: 18, max: 40 },
      { role: "Senior MLE (4–7 yrs)", min: 32, max: 65 },
      { role: "Staff / Principal MLE (7+ yrs)", min: 55, max: 90, note: "LLM/GenAI specialists command top of band" },
    ]} caption="India 2026 — GenAI and LLM fine-tuning skills command 30–50% premium over classical ML" />
  ),

  /* ML Engineer (Role Guide): fundamentals framework */
  "machine-learning-engineer-interview-questions-india-2026||ML Fundamentals: What Every Indian MLE Interview Tests": (
    <FrameworkSteps steps={[
      { number: "01", label: "ML Theory Foundations", hint: "Bias-variance, regularisation, optimisation algorithms, evaluation metrics" },
      { number: "02", label: "Python and ML Libraries", hint: "NumPy, pandas, scikit-learn, PyTorch or TensorFlow proficiency" },
      { number: "03", label: "ML System Design", hint: "Feature stores, training pipelines, serving infrastructure, A/B testing" },
      { number: "04", label: "GenAI and LLM Skills", hint: "Prompt engineering, RAG, fine-tuning, vector databases, LangChain" },
      { number: "05", label: "MLOps", hint: "Model versioning (MLflow), deployment (BentoML/Triton), monitoring drift" },
    ]} />
  ),

  /* Backend Developer (Role Guide): salary ladder */
  "backend-developer-interview-questions-india-2026||Backend Developer Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior Backend Developer (0–2 yrs)", min: 6, max: 15 },
      { role: "Backend Developer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior Backend Developer (4–7 yrs)", min: 25, max: 50 },
      { role: "Staff / Principal Engineer (7–10 yrs)", min: 40, max: 70 },
      { role: "Distinguished Engineer (10+ yrs)", min: 55, max: 80, note: "Rare; primarily at FAANG and top unicorns" },
    ]} caption="India 2026 — Golang, Java, or distributed systems expertise at scale pays top of band" />
  ),

  /* Backend Developer (Role Guide): language choice framework */
  "backend-developer-interview-questions-india-2026||Which Backend Language to Use in Indian Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pick Your Primary Language", hint: "Java for enterprise, Python for data-adjacent, Go for performance, Node for startups" },
      { number: "02", label: "Master Database Design", hint: "Relational modelling, indexing, query planning, caching strategies" },
      { number: "03", label: "API and Distributed Patterns", hint: "REST, gRPC, event-driven with Kafka, idempotency, circuit breakers" },
      { number: "04", label: "Concurrency and Performance", hint: "Thread pools, async I/O, connection pooling, profiling and benchmarking" },
      { number: "05", label: "System Design Fluency", hint: "Scalability patterns, CAP theorem, consistent hashing, rate limiting" },
    ]} />
  ),

  /* DevOps/SRE (Role Guide, first instance): salary ladder */
  "devops-sre-interview-questions-india-2026||DevOps and SRE Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior DevOps / Platform Engineer (0–2 yrs)", min: 7, max: 16 },
      { role: "DevOps Engineer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior DevOps / SRE (4–7 yrs)", min: 25, max: 50 },
      { role: "Staff SRE / Platform Lead (7+ yrs)", min: 40, max: 70, note: "K8s + Terraform + observability expertise commands top pay" },
    ]} caption="India 2026 — SRE roles at product companies pay 20–30% more than DevOps at service IT" />
  ),

  /* DevOps/SRE (Role Guide, first instance): K8s framework */
  "devops-sre-interview-questions-india-2026||Kubernetes and Container Orchestration Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Containerisation Fundamentals", hint: "Docker internals, image layering, multi-stage builds, registries" },
      { number: "02", label: "Kubernetes Core", hint: "Pods, Deployments, Services, Ingress, ConfigMaps, Secrets" },
      { number: "03", label: "CI/CD Pipeline Design", hint: "Jenkins/GitHub Actions, GitOps with ArgoCD, rollback strategies" },
      { number: "04", label: "Observability Stack", hint: "Prometheus, Grafana, ELK/Loki, distributed tracing, SLO/SLA/SLI" },
      { number: "05", label: "Infrastructure as Code", hint: "Terraform, Helm charts, cloud-native patterns on AWS/GCP/Azure" },
    ]} />
  ),

  /* Android Developer (Role Guide, first instance): salary ladder */
  "android-developer-interview-questions-india-2026||Android Developer Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior Android Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Android Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior Android Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Principal Android Engineer (7+ yrs)", min: 35, max: 55, note: "Kotlin Multiplatform skills add premium" },
    ]} caption="India 2026 — Jetpack Compose + Kotlin Coroutines is the dominant skill stack" />
  ),

  /* Android Developer (Role Guide, first instance): Kotlin fundamentals framework */
  "android-developer-interview-questions-india-2026||Kotlin Fundamentals: What Every Android Interview Tests": (
    <FrameworkSteps steps={[
      { number: "01", label: "Kotlin Language Depth", hint: "Coroutines, Flow, data/sealed classes, extension functions, generics" },
      { number: "02", label: "Android Architecture", hint: "MVVM + Clean Architecture, Hilt/Dagger DI, Repository pattern" },
      { number: "03", label: "Jetpack Compose", hint: "Composable functions, state hoisting, recomposition, navigation" },
      { number: "04", label: "Performance on Low-End Devices", hint: "Memory profiling, ANR avoidance, startup time, battery optimisation" },
      { number: "05", label: "Testing and CI/CD", hint: "JUnit, Espresso, Robolectric, Firebase Test Lab, GitHub Actions" },
    ]} />
  ),

  /* Data Engineer (Role Guide): salary ladder */
  "data-engineer-interview-questions-india-2026||Data Engineer Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "Junior Data Engineer (0–2 yrs)", min: 8, max: 16 },
      { role: "Data Engineer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior Data Engineer (4–7 yrs)", min: 24, max: 45 },
      { role: "Staff / Principal Data Engineer (7+ yrs)", min: 38, max: 65, note: "Spark + Kafka + dbt + cloud data stack expertise" },
    ]} caption="India 2026 — Real-time streaming (Kafka + Flink) expertise commands 20% premium over batch-only" />
  ),

  /* Data Engineer (Role Guide): Spark framework */
  "data-engineer-interview-questions-india-2026||Apache Spark Interview Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "SQL and Data Modelling", hint: "Star/snowflake schema, slowly changing dimensions, query optimisation" },
      { number: "02", label: "Apache Spark", hint: "RDD vs DataFrame, partitioning, caching, broadcast joins, Spark SQL" },
      { number: "03", label: "Real-Time Streaming", hint: "Kafka producers/consumers, Kafka Streams, Spark Structured Streaming" },
      { number: "04", label: "Pipeline Orchestration", hint: "Apache Airflow DAGs, dbt transformations, data quality testing" },
      { number: "05", label: "Cloud Data Stacks", hint: "BigQuery/Redshift/Snowflake, Delta Lake, cloud storage patterns" },
    ]} />
  ),

  /* System Design (Role Guide): career framework */
  "system-design-interview-questions-india-2026||The System Design Interview Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify Requirements", hint: "Functional requirements, scale targets (QPS/DAU), latency SLA, constraints" },
      { number: "02", label: "Estimate Scale", hint: "Storage, bandwidth, QPS calculations — anchor your design to real numbers" },
      { number: "03", label: "High-Level Design", hint: "Core components: clients, API layer, services, databases, cache, CDN" },
      { number: "04", label: "Deep Dive", hint: "Pick 2–3 critical components the interviewer signals; go deep on trade-offs" },
      { number: "05", label: "Address Bottlenecks", hint: "Identify single points of failure, discuss sharding, replication, failover" },
      { number: "06", label: "Wrap Up", hint: "Summarise trade-offs, mention monitoring, future scalability considerations" },
    ]} />
  ),

  /* System Design (Role Guide): salary ladder for senior engineers */
  "system-design-interview-questions-india-2026||How to Practise System Design for Indian Interviews": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "SDE-1 / Junior (system design not expected)", min: 12, max: 25 },
      { role: "SDE-2 / Mid-Level (basic HLD expected)", min: 22, max: 45 },
      { role: "SDE-3 / Senior (full system design required)", min: 38, max: 70 },
      { role: "Staff Engineer (leads the system design round)", min: 55, max: 90, note: "Can make or break the hire decision" },
    ]} caption="India 2026 — System design is the gate for SDE-2+ roles at product companies" />
  ),

  /* iOS Developer (Role Guide): salary ladder */
  "ios-developer-interview-questions-india-2026||iOS Architecture and iOS Developer Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior iOS Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "iOS Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior iOS Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Principal iOS Engineer (7+ yrs)", min: 35, max: 55, note: "SwiftUI + Combine + performance depth commands top pay" },
    ]} caption="India 2026 — iOS roles are rarer than Android; premium exists for experienced engineers" />
  ),

  /* iOS Developer (Role Guide): Swift fundamentals framework */
  "ios-developer-interview-questions-india-2026||Swift Fundamentals Tested in iOS Developer Interviews in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Swift Language Depth", hint: "Optionals, value vs reference types, generics, protocols, error handling" },
      { number: "02", label: "Concurrency: async/await and Actors", hint: "Structured concurrency, MainActor, async sequences, migration from GCD" },
      { number: "03", label: "UIKit vs SwiftUI", hint: "UIViewController lifecycle, SwiftUI declarative model, interoperability" },
      { number: "04", label: "iOS Architecture", hint: "MVC vs MVVM vs TCA, Combine or async/await for data flow, modularisation" },
      { number: "05", label: "Performance and Testing", hint: "Instruments profiling, XCTest, memory leaks, App Store submission" },
    ]} />
  ),

  /* QA/SDET (Role Guide): salary ladder */
  "qa-sdet-interview-questions-india-2026||SDET Salary Benchmarks and Career Paths in India 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "QA Engineer (0–2 yrs)", min: 4, max: 10 },
      { role: "SDET / Automation Engineer (2–4 yrs)", min: 8, max: 18 },
      { role: "Senior SDET (4–7 yrs)", min: 15, max: 30 },
      { role: "QA Lead / Principal SDET (7+ yrs)", min: 24, max: 45, note: "Performance and security testing expertise boosts pay" },
    ]} caption="India 2026 — Selenium + Cypress + API automation + CI/CD integration is the core skill set" />
  ),

  /* QA/SDET (Role Guide): QA vs SDET framework */
  "qa-sdet-interview-questions-india-2026||QA Engineer vs SDET: Understanding the Difference for Indian Tech Careers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Manual Testing Mastery", hint: "Test planning, BDD/Gherkin, exploratory testing, defect reporting" },
      { number: "02", label: "Automation Foundations", hint: "Selenium WebDriver, TestNG/JUnit, page object model, locator strategies" },
      { number: "03", label: "API and Backend Testing", hint: "Postman, RestAssured, contract testing with Pact, database validation" },
      { number: "04", label: "CI/CD Integration", hint: "Jenkins/GitHub Actions pipelines, Docker test environments, parallel runs" },
      { number: "05", label: "Performance and Security", hint: "JMeter/Gatling load testing, OWASP top-10 basics, static analysis" },
    ]} />
  ),

  /* Full-Stack Developer (Role Guide): salary ladder */
  "full-stack-developer-interview-questions-india-2026||Full-Stack Portfolio Projects and Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior Full-Stack Developer (0–2 yrs)", min: 7, max: 16 },
      { role: "Full-Stack Developer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior Full-Stack Developer (4–7 yrs)", min: 24, max: 50 },
      { role: "Lead / Principal Full-Stack Engineer (7+ yrs)", min: 40, max: 70, note: "MERN or MEAN with cloud-native delivery" },
    ]} caption="India 2026 — React + Node.js + PostgreSQL + AWS remains the most in-demand full-stack combination" />
  ),

  /* Full-Stack Developer (Role Guide): interview framework */
  "full-stack-developer-interview-questions-india-2026||Frontend Interview Topics for Full-Stack Roles in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Frontend Depth", hint: "JavaScript event loop, React hooks and performance, CSS layout mastery" },
      { number: "02", label: "Backend Proficiency", hint: "REST API design, Node.js/Express, authentication patterns, error handling" },
      { number: "03", label: "Database Skills", hint: "SQL (joins, indexes), NoSQL (MongoDB), ORM usage, schema design" },
      { number: "04", label: "End-to-End System Design", hint: "Feature-level design covering frontend, API, DB, caching, and deployment" },
      { number: "05", label: "DevOps Basics", hint: "Docker, CI/CD pipeline, deployment to AWS/GCP, monitoring fundamentals" },
    ]} />
  ),

  /* Product Manager (Role Guide, second instance): salary ladder */
  "product-manager-interview-questions-india-2026||PM Salaries in India 2026": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "APM / Associate PM (0–2 yrs)", min: 15, max: 30, note: "MBA programs or new-grad APM tracks" },
      { role: "Product Manager (2–5 yrs)", min: 28, max: 55 },
      { role: "Senior PM (5–8 yrs)", min: 45, max: 85 },
      { role: "Group PM / Director of Product (8+ yrs)", min: 70, max: 120 },
    ]} caption="India 2026 — Razorpay, PhonePe, Flipkart, CRED, and FAANG India pay highest PM salaries" />
  ),

  /* Product Manager (Role Guide, second instance): product design framework */
  "product-manager-interview-questions-india-2026||Product Design Framework for Indian PM Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the User", hint: "Define user segments, map journeys, identify the top pain point" },
      { number: "02", label: "Define the Problem", hint: "Reframe the prompt as a 'How might we...' with clear success definition" },
      { number: "03", label: "Generate Solutions", hint: "Brainstorm broadly, then narrow using impact vs effort analysis" },
      { number: "04", label: "Prioritise", hint: "Use RICE or ICE scoring; explain your trade-offs explicitly" },
      { number: "05", label: "Measure Success", hint: "North star metric + 2–3 guardrail metrics + experiment design" },
    ]} />
  ),

  /* Data Scientist (Role Guide): salary ladder */
  "data-scientist-interview-questions-india-2026||Data Scientist Salaries in India 2026": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "Junior Data Scientist (0–2 yrs)", min: 8, max: 18 },
      { role: "Data Scientist (2–4 yrs)", min: 16, max: 35 },
      { role: "Senior Data Scientist (4–7 yrs)", min: 28, max: 55 },
      { role: "Principal / Staff Data Scientist (7+ yrs)", min: 45, max: 75, note: "Causal inference and experimentation depth commands top pay" },
    ]} caption="India 2026 — Statistics depth + ML engineering skills + business acumen is the winning combination" />
  ),

  /* Data Scientist (Role Guide): interview framework */
  "data-scientist-interview-questions-india-2026||Data Scientist Interview Question Types in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Statistics and Probability", hint: "Distributions, hypothesis testing, p-values, A/B test design, CLT" },
      { number: "02", label: "Machine Learning Depth", hint: "Model selection, feature engineering, regularisation, evaluation metrics" },
      { number: "03", label: "SQL and Python", hint: "Complex SQL (window functions, CTEs), pandas data manipulation, EDA" },
      { number: "04", label: "ML System Design", hint: "Recommenders, fraud detection, feature stores, training vs serving" },
      { number: "05", label: "Business Case and Product Intuition", hint: "Metric definition, root cause analysis, experiment interpretation" },
    ]} />
  ),

  /* DevOps/SRE (Role Guide, second instance): salary ladder */
  "devops-sre-interview-questions-india-2026||DevOps/SRE Salaries in India 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior DevOps Engineer (0–2 yrs)", min: 7, max: 16 },
      { role: "DevOps / Platform Engineer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior SRE / DevOps (4–7 yrs)", min: 26, max: 50 },
      { role: "Staff SRE / Platform Architect (7+ yrs)", min: 42, max: 70, note: "Platform engineering at unicorns pays at top of band" },
    ]} caption="India 2026 — SRE roles at Razorpay, PhonePe, and Google India pay significantly above market" />
  ),

  /* DevOps/SRE (Role Guide, second instance): K8s and infra framework */
  "devops-sre-interview-questions-india-2026||Kubernetes and Infrastructure Topics in DevOps/SRE Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Linux and Networking Foundations", hint: "Processes, filesystems, TCP/IP, DNS, load balancing concepts" },
      { number: "02", label: "Containerisation and Kubernetes", hint: "Docker, K8s architecture, Helm, scheduling, RBAC, network policies" },
      { number: "03", label: "CI/CD and GitOps", hint: "Pipeline design, ArgoCD/Flux, blue-green and canary deployments" },
      { number: "04", label: "Observability", hint: "Metrics (Prometheus/Grafana), logs (ELK/Loki), traces (Jaeger), SLOs" },
      { number: "05", label: "Cloud Infrastructure", hint: "IaC with Terraform, cloud cost optimisation, multi-region reliability" },
    ]} />
  ),

  /* Android Developer (Role Guide, second instance): salary ladder */
  "android-developer-interview-questions-india-2026||Android Developer Salaries in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior Android Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Android Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior Android Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Principal Android Engineer (7+ yrs)", min: 35, max: 55 },
    ]} caption="India 2026 — Companies like PhonePe, Swiggy, Razorpay, and CRED pay top Android salaries" />
  ),

  /* Android Developer (Role Guide, second instance): Kotlin depth framework */
  "android-developer-interview-questions-india-2026||Kotlin Depth Tested in Android Developer Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Kotlin Core", hint: "Coroutines, Flow, sealed classes, delegation, inline functions" },
      { number: "02", label: "Architecture (MVVM + Clean)", hint: "ViewModel, LiveData vs StateFlow, Use Cases, Repository, Hilt DI" },
      { number: "03", label: "Jetpack Compose", hint: "State management, side effects, navigation, lazy lists, theming" },
      { number: "04", label: "Performance and Debugging", hint: "Memory leaks (LeakCanary), Baseline Profiles, ANR detection" },
      { number: "05", label: "Testing", hint: "Unit tests (JUnit + MockK), integration tests, UI tests (Espresso/Compose)" },
    ]} />
  ),

  /* ── Behavioral, Interview Skills & Strategy ── */
  /* ── Behavioral Posts ── */

  /* Behavioral: top-10-google-interview-questions */
  "top-10-google-interview-questions||1. Tell me about a time you led a project with ambiguous requirements": (
    <FrameworkSteps steps={[
      { number: "S", label: "Set the Scene", hint: "Name the project, org context, and why requirements were unclear — 2 sentences max" },
      { number: "T", label: "State YOUR Task", hint: "What were YOU specifically responsible for deciding or delivering?" },
      { number: "A", label: "Describe YOUR Actions", hint: "List 2–3 concrete choices: how you gathered clarity, who you aligned with, what trade-offs you made" },
      { number: "R", label: "Quantify the Result", hint: "Ship date hit? Error rate? User impact? Metric that proves success" },
    ]} />
  ),

  /* Behavioral: hr-interview-questions-answers-india */
  "hr-interview-questions-answers-india||Answering 'What Are Your Weaknesses?'": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name a Real Weakness", hint: "Pick something genuine but not core to the job — e.g. public speaking, perfectionism on low-stakes tasks" },
      { number: "02", label: "Show Self-Awareness", hint: "Explain when and how you noticed this weakness with a brief, specific example" },
      { number: "03", label: "Describe What You Did", hint: "Name the exact steps you took: course, practice, system, or mentor" },
      { number: "04", label: "Show Progress", hint: "Mention a measurable improvement or recent win that demonstrates you are actively closing the gap" },
    ]} />
  ),

  /* Behavioral: hr-interview-questions-india-2026 — Tell Me About Yourself */
  "hr-interview-questions-india-2026||Tell Me About Yourself: How to Answer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Who You Are Now", hint: "Current role, tech stack, and the type of problems you solve. 1–2 sentences." },
      { number: "02", label: "Past — What Built You", hint: "1 key experience or project that is directly relevant to this role. Skip unrelated history." },
      { number: "03", label: "Future — Why This Role", hint: "Connect your trajectory to this company's domain or problem space. Make it specific." },
    ]} />
  ),

  /* Behavioral: tell-me-about-yourself-fresher-india-2026 */
  "tell-me-about-yourself-answer-fresher-india-2026||The Formula: Present → Past → Future (Under 90 Seconds)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Name + Degree + Branch", hint: "'I am a final-year CSE student at [College].' One sentence. No fluff." },
      { number: "02", label: "Past — One Strong Project or Internship", hint: "Name it, state the tech, and give one outcome metric. 2 sentences." },
      { number: "03", label: "Future — Why This Company", hint: "Tie your interest to the company's product or domain. Avoid generic 'growth opportunities'." },
      { number: "04", label: "Close — Invite Conversation", hint: "'I would love to contribute to [specific area] here.' Signals clarity and confidence." },
    ]} />
  ),

  /* Behavioral: why-do-you-want-to-join-our-company-answer-india-2026 */
  "why-do-you-want-to-join-our-company-answer-india-2026||The Framework: Why This Company, Why This Role, Why Now": (
    <FrameworkSteps steps={[
      { number: "01", label: "Why This Company", hint: "Name one specific product, initiative, or technology — not 'good reputation'. Show you researched." },
      { number: "02", label: "Why This Role", hint: "Map 1–2 skills from your background directly to what this role demands." },
      { number: "03", label: "Why Now", hint: "Explain the career inflection point: what you are ready to do next and why timing matters." },
      { number: "04", label: "Tie It Together", hint: "One sentence connecting company mission + your skill + your timing into a coherent narrative." },
    ]} />
  ),

  /* Behavioral: career-gap-explanation-interview-india-2026 */
  "career-gap-explanation-interview-india-2026||The Core Principle: Frame, Don't Apologise": (
    <FrameworkSteps steps={[
      { number: "01", label: "Acknowledge the Gap Briefly", hint: "State the dates and reason in one sentence. No over-explaining, no apologies." },
      { number: "02", label: "What You Did During the Gap", hint: "Name any upskilling, freelance work, certification, or caregiving. Even informal learning counts." },
      { number: "03", label: "What You Learned or Built", hint: "One concrete output: a project, a certificate, a skill now directly relevant to this role." },
      { number: "04", label: "Bridge to Today", hint: "'I am now ready to …' — forward-looking statement that closes the gap narrative." },
    ]} />
  ),

  /* Behavioral: star-method-interview-answers-india-2026 */
  "star-method-interview-answers-india-2026||How STAR Works: and Where Most Candidates Go Wrong": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation — Set Context Fast", hint: "One sentence: company type, team size, the business condition. Do NOT spend more than 15% of your time here." },
      { number: "T", label: "Task — YOUR Responsibility", hint: "What were YOU asked to own or deliver? Distinguish your role from the team's role." },
      { number: "A", label: "Action — What YOU Did", hint: "3–4 specific actions. Use 'I' not 'we'. This is 60% of your answer and where most candidates are too vague." },
      { number: "R", label: "Result — Numbers Win", hint: "Quantify: time saved, revenue impact, error reduction, user growth. If no number, state the business outcome." },
    ]} />
  ),

  /* Behavioral: walk-me-through-your-resume-answer-guide */
  "walk-me-through-your-resume-answer-guide||The PPF Framework: Present, Past, Future": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Current Role & Impact", hint: "What you do now and one metric or outcome you are proud of. 30 seconds." },
      { number: "02", label: "Past — The Thread That Connects", hint: "1–2 experiences that built the skill most relevant to THIS role. Skip everything else." },
      { number: "03", label: "Future — Why Here, Why Now", hint: "Where you want to go and why this company is the right next step. Be specific." },
      { number: "04", label: "Invite Depth", hint: "'Happy to go deeper on any of these.' Signals confidence and hands control to the interviewer." },
    ]} />
  ),

  /* Behavioral: where-do-you-see-yourself-in-5-years-answer */
  "where-do-you-see-yourself-in-5-years-answer||The Formula: Skill + Impact + Alignment": (
    <FrameworkSteps steps={[
      { number: "01", label: "Skill — What You Want to Master", hint: "Name a specific technical or leadership capability. Vague answers ('grow as a professional') signal no vision." },
      { number: "02", label: "Impact — What Problem You Want to Solve", hint: "Connect the skill to a business or product outcome you want to own." },
      { number: "03", label: "Alignment — Why This Company Is the Path", hint: "Show how this role builds toward your goal. Avoid answers that work at any company." },
    ]} />
  ),

  /* Behavioral: tell-me-about-yourself-experienced-professionals-india */
  "tell-me-about-yourself-experienced-professionals-india||The Strategic Answer Architecture": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open with Your Current Role and Scope", hint: "Job title, team size or product scale, and the type of impact you drive. 1 sentence." },
      { number: "02", label: "Pick ONE Career Highlight", hint: "The one achievement most relevant to this company's domain. Metrics required." },
      { number: "03", label: "State What You Are Looking For", hint: "Specific challenge, scale, or technology. Not 'new opportunity' — be precise." },
      { number: "04", label: "Close with Why This Company", hint: "Connect their product or mission to what you just said you want. 1 sentence." },
    ]} />
  ),

  /* Behavioral: how-to-answer-what-are-your-weaknesses-india */
  "how-to-answer-what-are-your-weaknesses-india||The Formula That Works": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name the Weakness Directly", hint: "State it in one sentence. No hedging ('my weakness is I work too hard'). That answer is rejected." },
      { number: "02", label: "Give a Specific Past Example", hint: "A brief story where this weakness created a real, minor problem. Shows authenticity." },
      { number: "03", label: "Describe Your Mitigation System", hint: "The habit, tool, or process you now use to prevent the weakness from causing problems." },
      { number: "04", label: "Show Recent Progress", hint: "One recent result or situation where your mitigation system worked." },
    ]} />
  ),

  /* Behavioral: star-method-interview-examples-india */
  "star-method-interview-examples-india||The STAR Framework Explained": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation", hint: "Set the context in 1–2 sentences: org type, team, the specific challenge or opportunity." },
      { number: "T", label: "Task", hint: "YOUR specific responsibility. Make it clear this was YOUR task, not the team's." },
      { number: "A", label: "Action", hint: "3 concrete steps YOU took. Use 'I chose…', 'I built…', 'I proposed…'. Avoid 'we'." },
      { number: "R", label: "Result", hint: "Quantified outcome: percentage, INR, time saved, users impacted. End with business impact." },
    ]} />
  ),

  /* Behavioral: tell-me-about-yourself-answer-india-2026 */
  "tell-me-about-yourself-answer-india-2026||The 3-part formula that works in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Current Role or Status", hint: "Who you are professionally right now. For freshers: degree + college + relevant project. For experienced: role + company + key impact." },
      { number: "02", label: "Past — What Led Here", hint: "The most relevant experience or decision that connects your background to this role. One example only." },
      { number: "03", label: "Future — Why This Role", hint: "What you want to achieve next and why this specific company is the right fit. Avoid generic answers." },
    ]} />
  ),

  /* Behavioral: behavioral-interview-questions-india-2026 */
  "behavioral-interview-questions-india-2026||The STAR Framework: Applied Correctly": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation — Context Only (15%)", hint: "One sentence: industry, team size, the triggering event. Interviewers do not need your full project history." },
      { number: "T", label: "Task — Your Ownership (10%)", hint: "Define exactly what YOU were accountable for. Differentiate from what the team did." },
      { number: "A", label: "Action — Your Decisions (60%)", hint: "Walk through each specific action, decision, or trade-off YOU made. This is where candidates are graded." },
      { number: "R", label: "Result — Proof (15%)", hint: "Quantified business impact. If exact numbers are confidential, give an order of magnitude." },
    ]} />
  ),

  /* Behavioral: hr-interview-questions-answers-india-2026 */
  "hr-interview-questions-answers-india-2026||STAR method behavioural questions": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation", hint: "Set context briefly — project type, team, timeline. 1–2 sentences." },
      { number: "T", label: "Task", hint: "State what YOUR goal or responsibility was, distinct from the team's." },
      { number: "A", label: "Action", hint: "3 specific actions YOU personally took. Avoid 'we'. Explain the why behind each decision." },
      { number: "R", label: "Result", hint: "Outcome with numbers: time saved, bug reduction, user growth, revenue impact." },
    ]} />
  ),

  /* Behavioral: interview-preparation-for-introverts-india-2026 */
  "interview-preparation-for-introverts-india-2026||Turning introversion into an interview advantage": (
    <FrameworkSteps steps={[
      { number: "01", label: "Prepare Depth, Not Breadth", hint: "Introverts can prepare 5–6 stories so thoroughly that answers feel polished and thoughtful rather than rehearsed." },
      { number: "02", label: "Use Structured Frameworks", hint: "STAR, PPF, and numbered lists buy processing time without awkward pauses. Say 'There are three points...' to buy thinking time." },
      { number: "03", label: "Leverage Written Thinking", hint: "Use take-home tasks, coding problems, and whiteboard time — formats where introverts consistently outperform." },
      { number: "04", label: "Reframe the Pause", hint: "Indian interviews read thinking-pause as confidence. Say 'Let me think for a moment' — do not apologise for it." },
    ]} />
  ),

  /* ── Interview Skills Posts ── */

  /* Interview Skills: how-to-answer-tell-me-about-yourself-india */
  "how-to-answer-tell-me-about-yourself-india||The Framework: Present-Past-Future": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — What You Do Now", hint: "Role, domain, and one line about the type of problems you solve. For freshers: final year + branch + strongest project." },
      { number: "02", label: "Past — What Built You", hint: "The ONE experience most relevant to this interviewer's company or domain. One sentence with a metric or outcome." },
      { number: "03", label: "Future — Why This Role", hint: "What skill or scale you want next, and why this specific role is the right vehicle. Be specific — not 'growth'." },
      { number: "04", label: "Keep It Under 90 Seconds", hint: "Time yourself. If it runs longer, cut the past section. The interviewer wants a map, not a tour." },
    ]} />
  ),

  /* Interview Skills: how-to-answer-greatest-weakness-interview-india */
  "how-to-answer-greatest-weakness-interview-india||What Interviewers Are Actually Testing": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name the Real Weakness", hint: "Choose something genuine and not central to this job. Avoid clichés like 'I work too hard'." },
      { number: "02", label: "Acknowledge Impact with a Mini-Story", hint: "One brief example where this weakness caused a minor problem. This shows honesty and self-awareness." },
      { number: "03", label: "Show What You Have Done About It", hint: "The specific habit, tool, or system you use to manage the weakness. Concrete details matter." },
      { number: "04", label: "Demonstrate Progress", hint: "A recent situation where your mitigation worked. Ends on a forward-looking, growth-oriented note." },
    ]} />
  ),

  /* Interview Skills: star-method-interview-examples-india-freshers */
  "star-method-interview-examples-india-freshers||What Is the STAR Method and Why Indian Companies Use It": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation — College Context", hint: "Name the course project, club, or internship. State the team size and the problem you faced." },
      { number: "T", label: "Task — Your Role", hint: "What were YOU specifically responsible for? Be precise — 'I led the backend' not 'we built the app'." },
      { number: "A", label: "Action — What YOU Did", hint: "3 specific steps: the tool chosen, the decision made, the conflict handled. Use 'I' throughout." },
      { number: "R", label: "Result — College-Level Metrics", hint: "Demo day feedback, professor score, lines of code, latency improvement, users in beta. Numbers matter even for freshers." },
    ]} />
  ),

  /* Interview Skills: how-to-answer-salary-expectations-india-2026 */
  "how-to-answer-salary-expectations-india-2026||Research Your Market Value Before the Interview": (
    <FrameworkSteps steps={[
      { number: "01", label: "Research Market Range", hint: "Check Glassdoor, AmbitionBox, Levels.fyi for this exact role + city + years of experience before the interview." },
      { number: "02", label: "Anchor High in Your Range", hint: "State the top 30% of the market range, not the median. You can always come down; you cannot go up." },
      { number: "03", label: "Defer If Asked Too Early", hint: "If asked before an offer: 'I am open to a competitive offer — what is the budgeted range for this role?'" },
      { number: "04", label: "Negotiate After Offer Letter", hint: "Once you have the number in writing, take 24–48 hours. Counter with a specific number + justification, not a vague 'can you do better?'" },
    ]} />
  ),

  /* Interview Skills: how-to-answer-why-do-you-want-to-leave-current-company */
  "how-to-answer-why-do-you-want-to-leave-current-company||The Framework: Pull Toward, Not Push Away": (
    <FrameworkSteps steps={[
      { number: "01", label: "Lead with Pull, Not Push", hint: "Start with what you want to move TOWARD: a technology, scale, domain, or scope. Not what you are running from." },
      { number: "02", label: "Acknowledge the Positive", hint: "Name one genuine thing you valued at your current company. Shows maturity and avoids sounding bitter." },
      { number: "03", label: "Bridge to This Company", hint: "Connect what you want next specifically to this company's product, tech stack, or mission." },
      { number: "04", label: "Keep It Under 60 Seconds", hint: "Long answers on this question raise red flags. Say enough to satisfy curiosity, then stop." },
    ]} />
  ),

  /* Interview Skills: how-to-crack-coding-interview-india-2026 */
  "how-to-crack-coding-interview-india-2026||The 3 Phases of Coding Interview Preparation": (
    <FrameworkSteps steps={[
      { number: "01", label: "Foundations (Weeks 1–3)", hint: "Arrays, strings, hash maps, two pointers, sliding window. Solve 40–50 easy problems with full understanding, not memorisation." },
      { number: "02", label: "Core Patterns (Weeks 4–7)", hint: "Trees, graphs, BFS/DFS, binary search, DP basics. Solve 60–80 mediums. Learn to recognise which pattern a problem belongs to." },
      { number: "03", label: "Mock + Company Prep (Week 8+)", hint: "Timed mock interviews on Pramp or HireStepX. Filter company-tagged problems. Practice talking through your approach before coding." },
    ]} />
  ),

  /* Interview Skills: salary-negotiation-tips-india-2026 */
  "salary-negotiation-tips-india-2026||How to Negotiate: The Exact Script": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pause Before Responding", hint: "Say 'Thank you — I am excited about this offer. Can I take 24 hours to review it?' Never negotiate in the moment." },
      { number: "02", label: "State a Specific Counter", hint: "'Based on my research and [competing offer / current CTC / market data], I was expecting ₹X.' Name a number." },
      { number: "03", label: "Justify with Evidence", hint: "One sentence: market data, competing offer, or a specific skill/impact that justifies the ask." },
      { number: "04", label: "Stay Warm and Collaborative", hint: "End with 'I am genuinely excited about this role — I hope we can find a number that works.' Do not give ultimatums." },
    ]} />
  ),

  /* Interview Skills: fresher-resume-guide-india-2026 */
  "fresher-resume-guide-india-2026||How to Write Project Descriptions That Get Callbacks": (
    <FrameworkSteps steps={[
      { number: "01", label: "Lead with the Action Verb + Tech", hint: "'Built a real-time chat app using Node.js and WebSockets...' — not 'Worked on a project that...'." },
      { number: "02", label: "State the Problem Solved", hint: "One clause explaining WHY this project exists. Shows product thinking, not just coding." },
      { number: "03", label: "Quantify the Output", hint: "Users, latency, accuracy, uptime, lines of code reduced. Even 'served 200 beta users' beats nothing." },
      { number: "04", label: "Link to GitHub", hint: "Every project must have a public repo. Recruiters open links. No repo = the project did not happen." },
    ]} />
  ),

  /* Interview Skills: group-discussion-tips-india-campus-placements */
  "group-discussion-tips-india-campus-placements||How to Enter, Contribute, and Stand Out in a GD": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open with a Frame, Not an Opinion", hint: "'This topic has two sides worth examining...' — framing the discussion is more valued than rushing to a position." },
      { number: "02", label: "Make 2–3 Substantive Points", hint: "Quality beats quantity. Evaluators penalise filler speech. One point with a fact beats three empty opinions." },
      { number: "03", label: "Acknowledge and Build", hint: "'Building on what [Name] said...' — shows listening skill, a top evaluation criterion." },
      { number: "04", label: "Redirect, Do Not Interrupt", hint: "Wait for a pause, then: 'I think we should also consider...' — entering forcefully loses points." },
      { number: "05", label: "Close with a Summary", hint: "If asked to conclude: restate both sides, then give a balanced takeaway. Do not just repeat your own point." },
    ]} />
  ),

  /* Interview Skills: how-to-get-promoted-software-engineer-india-2026 */
  "how-to-get-promoted-software-engineer-india-2026||The Three Highest-Leverage Promotion Accelerators": (
    <FrameworkSteps steps={[
      { number: "01", label: "Operate Visibly at the Next Level", hint: "Do not wait to be promoted to do next-level work. Lead one cross-team project, own one major initiative. Document it." },
      { number: "02", label: "Get a Sponsor, Not Just a Mentor", hint: "A sponsor advocates for you in the calibration room. Mentors give advice. Identify who has that influence and earn their trust." },
      { number: "03", label: "Build a Promotion Document", hint: "Maintain a running list of your impact: metrics, projects shipped, cross-team work. Share it with your manager 6 months before review." },
    ]} />
  ),

  /* Interview Skills: how-to-negotiate-job-offer-india-software-engineer-2026 */
  "how-to-negotiate-job-offer-india-software-engineer-2026||What to Say: The Counter-Offer Script": (
    <FrameworkSteps steps={[
      { number: "01", label: "Buy Time First", hint: "'Thank you — I am very excited. Can I take until [specific date] to review the full package?' Always get it in writing before negotiating." },
      { number: "02", label: "Open with Gratitude + Anchor", hint: "'I am genuinely excited about this offer. Based on my research, I was expecting something closer to ₹X.' State the number confidently." },
      { number: "03", label: "Justify in One Sentence", hint: "Market rate, competing offer, or a specific skill/achievement: 'Given my experience with [X] and the market range of ₹Y–₹Z...'." },
      { number: "04", label: "Stay Silent After Your Ask", hint: "After stating your counter, stop talking. The first person to speak loses negotiating leverage." },
    ]} />
  ),

  /* Interview Skills: tell-me-about-yourself-answer-india-software-engineer-2026 */
  "tell-me-about-yourself-answer-india-software-engineer-2026||The Best Framework for Experienced Engineers: Present-Past-Future": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Role + Impact", hint: "Current title, tech stack, and one metric that shows scale or impact. 1–2 sentences." },
      { number: "02", label: "Past — The Most Relevant Thread", hint: "Pick the ONE past experience most relevant to THIS company. Skip everything else on your resume." },
      { number: "03", label: "Future — Your Specific Goal", hint: "What you want to build or learn next — tied directly to what this company does. Avoid 'new challenges'." },
      { number: "04", label: "Close + Invite", hint: "'I would love to talk about how my background maps to what you are building.' Hands control to the interviewer." },
    ]} />
  ),

  /* Interview Skills: how-to-answer-why-leaving-current-job */
  "how-to-answer-why-leaving-current-job||Four Answer Frameworks That Work for Indian Tech Engineers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Growth Ceiling Frame", hint: "'I have delivered [X] and I am ready for [Y scope/scale/technology]. This company is the right place for that next step.'" },
      { number: "02", label: "Domain Pivot Frame", hint: "'My current role is in [domain A] but I want to deepen in [domain B] — which is what your team is building.'" },
      { number: "03", label: "Technology Stack Frame", hint: "'I want to work with [specific tech] at scale. Your infra is built on exactly that.' Requires prior research." },
      { number: "04", label: "Impact Frame", hint: "'I want to work on a product that reaches [X users / market]. That scale aligns with what you are building.'" },
    ]} />
  ),

  /* Interview Skills: linkedin-profile-tips-india-software-engineer-2026 */
  "linkedin-profile-tips-india-software-engineer-2026||Seven LinkedIn Optimisations That Actually Increase Recruiter Messages": (
    <FrameworkSteps steps={[
      { number: "01", label: "Headline = Role + Stack + Differentiator", hint: "'Senior Backend Engineer | Go, Kafka, Distributed Systems | Building for Scale' — not 'Software Engineer at Company'." },
      { number: "02", label: "Turn On Open to Work (Recruiters Only)", hint: "Set visibility to 'Recruiters only' — your current employer cannot see it. Include target roles and locations." },
      { number: "03", label: "About Section = 3-Sentence Pitch", hint: "What you build, how you think, and what you are looking for. First line must hook — it appears before 'see more'." },
      { number: "04", label: "Quantify Every Role", hint: "Each experience bullet: verb + metric + scale. 'Reduced API latency by 40% serving 2M daily requests.'" },
      { number: "05", label: "Add 5 Specific Skills", hint: "List the technologies at the TOP of your skills. Recruiters filter by skill keywords." },
      { number: "06", label: "Get 3 Endorsements for Top Skills", hint: "Ask former colleagues. Endorsed skills rank higher in LinkedIn search." },
      { number: "07", label: "Post or Comment Once a Week", hint: "Activity boosts your profile in recruiter search. A technical insight or project post performs best." },
    ]} />
  ),

  /* Interview Skills: where-do-you-see-yourself-in-5-years-india-tech-interview */
  "where-do-you-see-yourself-in-5-years-india-tech-interview||Framework for Experienced Engineers (3+ Years)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name a Technical or Leadership Goal", hint: "Staff engineer, engineering manager, ML specialist — be specific. 'Grow as a professional' is a non-answer." },
      { number: "02", label: "Connect to a Problem Domain", hint: "What type of problem do you want to be known for solving? Distributed systems, product growth, ML infra?" },
      { number: "03", label: "Show How This Role Is the Path", hint: "Specifically how this company's scale, product, or team structure lets you pursue that goal." },
      { number: "04", label: "Stay Realistic and Committed", hint: "Ambitious enough to show drive; grounded enough to signal you will stay long enough to deliver." },
    ]} />
  ),

  /* Interview Skills: coding-interview-preparation-guide-india-2026 */
  "coding-interview-preparation-guide-india-2026||8-Week Structured LeetCode Plan for Indian Product Companies": (
    <PrepTimeline caption="Structured coding interview prep for SDE-1/SDE-2 at Indian product companies" phases={[
      { period: "Week 1–2", label: "Foundations", tasks: ["Arrays, strings, hash maps (30 easy problems)", "Two pointers and sliding window", "Big-O analysis for every solution"], milestone: "Solve 30 easies without hints" },
      { period: "Week 3–4", label: "Core Data Structures", tasks: ["Linked lists, stacks, queues (20 mediums)", "Binary search and sorted arrays", "Trees: traversal, BST operations"], milestone: "Complete NeetCode Blind 75 Part 1" },
      { period: "Week 5–6", label: "Graphs and DP", tasks: ["BFS/DFS, topological sort (15 mediums)", "Dynamic programming: 1D then 2D", "Recursion and backtracking"], milestone: "Solve 10 company-tagged mediums for target company" },
      { period: "Week 7–8", label: "Mock and Polish", tasks: ["2 timed mock interviews per week", "Review all problems solved under time pressure", "Practice explaining approach before coding"], milestone: "Score 70%+ on 5 consecutive mocks" },
    ]} />
  ),

  /* ── Strategy Posts ── */

  /* Strategy: salary-negotiation-after-offer-letter-india */
  "salary-negotiation-after-offer-letter-india||The Counter-Offer Script": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pause and Request Time", hint: "'Thank you for the offer — I am excited. Can I have until [date] to review it?' Never negotiate same-day." },
      { number: "02", label: "State Your Number Confidently", hint: "'Based on my research and [current CTC / competing offer], I was expecting ₹X LPA.' Name a specific number." },
      { number: "03", label: "Justify in One Sentence", hint: "Market data (AmbitionBox, Glassdoor) + your specific skill or impact. One reason is enough." },
      { number: "04", label: "Stay Silent", hint: "After your counter, do not fill the silence. The recruiter will speak next. Waiting is power." },
      { number: "05", label: "Negotiate Beyond Base Salary", hint: "If base is fixed: ask for joining bonus, extra RSUs, or earlier appraisal cycle. Something usually moves." },
    ]} />
  ),
  "salary-negotiation-after-offer-letter-india||Why Most Indians Do Not Negotiate (and Why You Should)": (
    <PrepTimeline caption="Salary negotiation preparation timeline" phases={[
      { period: "2 Weeks Before Offer", label: "Research Phase", tasks: ["Check AmbitionBox and Glassdoor for role + city + experience band", "Research on Levels.fyi for product/FAANG companies", "Identify your walk-away number and your target number"], milestone: "Know your market range with confidence" },
      { period: "At Offer Stage", label: "Buy Time", tasks: ["Request 24–48 hours to review", "Get full CTC breakup in writing", "Calculate take-home vs CTC"], milestone: "Full offer letter in hand before negotiating" },
      { period: "Counter-Offer", label: "Negotiate Strategically", tasks: ["Counter with a specific number (not a range)", "Justify with one data point", "Negotiate non-salary if base is fixed"], milestone: "Written confirmation of revised offer" },
    ]} />
  ),

  /* Strategy: highest-paying-it-companies-india-2026 */
  "highest-paying-it-companies-india-2026||How to Use This Data Strategically": (
    <PrepTimeline caption="Career strategy roadmap to reach top-paying IT companies" phases={[
      { period: "Year 1–2", label: "Build Fundaments", tasks: ["Join any company — product preferred", "Get depth in 1 technology stack", "Ship to production and collect metrics"], milestone: "2 quantifiable projects on resume" },
      { period: "Year 2–3", label: "Demonstrate Scale", tasks: ["Target CRED/Razorpay/Meesho tier", "Prepare system design fundamentals", "Build DSA consistency: 150+ problems solved"], milestone: "First product company offer above ₹20 LPA" },
      { period: "Year 3–5", label: "Target FAANG India", tasks: ["Deep dive: distributed systems, advanced DSA", "Mock interviews for Google/Meta/Uber bar", "Build cross-functional impact at current job"], milestone: "₹40–80 LPA offer from FAANG India" },
    ]} />
  ),

  /* Strategy: salary-hike-negotiation-current-company-india */
  "salary-hike-negotiation-current-company-india||The Conversation: What to Say": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open with Context, Not Demand", hint: "'I wanted to discuss my compensation in light of the impact I have delivered this year.' Sets collaborative tone." },
      { number: "02", label: "Present Your Case with Numbers", hint: "List 3 specific contributions with metrics: 'I led [X] which reduced [Y] by [Z%].' Your manager cannot argue with your own data." },
      { number: "03", label: "Anchor with Market Data", hint: "'For my experience level and skills, the market range is ₹X–₹Y. I would like to align to that range.'" },
      { number: "04", label: "Name a Specific Number", hint: "Ask for the specific hike percentage or CTC you want. Do not say 'whatever you think is fair'." },
      { number: "05", label: "Give a Timeline", hint: "'Can we revisit this in two weeks?' Creates urgency and prevents indefinite deferral." },
    ]} />
  ),
  "salary-hike-negotiation-current-company-india||The Preparation: What to Do Before the Conversation": (
    <PrepTimeline caption="Internal salary negotiation preparation plan" phases={[
      { period: "4 Weeks Before", label: "Build Your Evidence File", tasks: ["List all projects delivered with metrics", "Note any scope expansion or new responsibilities", "Identify 1–2 cross-team contributions"], milestone: "Impact document ready" },
      { period: "2 Weeks Before", label: "Research Market", tasks: ["Check AmbitionBox for your role + company tier", "Get 1–2 data points from peers at competitor companies", "Know the market range for your exact experience band"], milestone: "Market data to anchor your ask" },
      { period: "1 Week Before", label: "Prepare and Time the Ask", tasks: ["Schedule the 1:1 for after a recent win or positive review", "Prepare your 2-minute opening: context + impact + ask", "Rehearse responses to 'budget is fixed' objection"], milestone: "Manager meeting scheduled" },
    ]} />
  ),

  /* Strategy: mba-vs-ms-vs-upskill-india-career-decision-2026 */
  "mba-vs-ms-vs-upskill-india-career-decision-2026||Decision framework: which path is right for you": (
    <FrameworkSteps steps={[
      { number: "01", label: "Define Your Goal Precisely", hint: "CTO path? Product management? Quant finance? Salary jump alone? Each goal has a different optimal path." },
      { number: "02", label: "Calculate True Cost and ROI", hint: "MBA: ₹30–70L + 2 years opportunity cost. MS: ₹50–120L. Upskilling: ₹0–5L. Payback period matters more than prestige." },
      { number: "03", label: "Test the Assumption", hint: "Can you achieve the goal WITHOUT the degree in 2–3 years? If yes, the degree rarely adds enough marginal value." },
      { number: "04", label: "Choose the Shortest Path to Your Goal", hint: "MBA for PM/consulting pivots. MS for research or top-tier global roles. Upskilling for most software career transitions." },
    ]} />
  ),

  /* Strategy: notice-period-buy-out-india-2026 */
  "notice-period-buy-out-india-2026||How to negotiate early joining": (
    <FrameworkSteps steps={[
      { number: "01", label: "Know Your Legal Obligation", hint: "Your employment contract defines the notice period. Buyout = you pay salary equivalent for remaining days. Calculate the exact amount." },
      { number: "02", label: "Get the New Employer to Pay", hint: "Ask HR: 'Is a joining bonus or buyout reimbursement available?' Many Indian product companies offer this. Ask before accepting." },
      { number: "03", label: "Negotiate With Current Employer", hint: "Offer to complete handover documentation in exchange for early release. Most companies prefer a clean exit over a grudging last month." },
      { number: "04", label: "Get the Release in Writing", hint: "Verbal agreement is not enough. Get the early relieving date confirmed by email with Experience Letter + relieving date confirmed." },
    ]} />
  ),

  /* Strategy: negotiation-tips-for-freshers-india-2026 */
  "negotiation-tips-for-freshers-india-2026||How to negotiate without risking your offer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Know What Is Negotiable", hint: "Freshers: stipend during training, joining date, location preference. Band/grade is harder but not impossible at product companies." },
      { number: "02", label: "Use a Competing Offer if You Have One", hint: "'I have an offer for ₹X from [Company]. Is there any flexibility here?' This is the most effective fresher lever." },
      { number: "03", label: "Negotiate Tone, Not Terms, If No Leverage", hint: "If only one offer: negotiate joining date, role clarity, or training stream. Never go silent — ask for something." },
      { number: "04", label: "Get Everything in Writing", hint: "Offer letter, joining date, role, location, CTC breakup — all confirmed before resigning from or declining any other offer." },
    ]} />
  ),

  /* Strategy: bangalore-salary-guide-software-engineers-2026 */
  "bangalore-salary-guide-software-engineers-2026||Software engineer salaries in Bengaluru by experience level": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Fresher / 0–1 YOE (IT Services)", min: 3, max: 7 },
      { role: "Fresher / 0–1 YOE (Product Company)", min: 12, max: 22 },
      { role: "SDE-1 / 2–3 YOE", min: 18, max: 35 },
      { role: "SDE-2 / 4–6 YOE", min: 30, max: 55 },
      { role: "SDE-3 / Senior / 6–9 YOE", min: 45, max: 80 },
      { role: "Staff / Principal (10+ YOE)", min: 65, max: 100, note: "FAANG India top band" },
    ]} caption="Bengaluru 2026 — fixed + RSU vesting. FAANG India top of range." />
  ),
  "bangalore-salary-guide-software-engineers-2026||Bengaluru vs Hyderabad vs Pune vs Chennai for SWE careers": (
    <TierCompare cards={[
      {
        tier: "Bengaluru",
        examples: "Flipkart · Swiggy · PhonePe · Google · Microsoft",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹35–55 LPA" },
          { label: "FAANG density", range: "Highest in India" },
          { label: "Cost of living", range: "High (rent ₹25–50K/mo)" },
          { label: "Product co. density", range: "Very High" },
        ]
      },
      {
        tier: "Hyderabad",
        examples: "Microsoft · Amazon · Google · Walmart GTC",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹30–50 LPA" },
          { label: "FAANG density", range: "High (GCC-heavy)" },
          { label: "Cost of living", range: "Medium (rent ₹18–35K/mo)" },
          { label: "Product co. density", range: "High" },
        ]
      },
      {
        tier: "Pune",
        examples: "Persistent · Cummins Tech · Thoughtworks",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹22–38 LPA" },
          { label: "FAANG density", range: "Low" },
          { label: "Cost of living", range: "Medium-Low" },
          { label: "Product co. density", range: "Medium" },
        ]
      },
      {
        tier: "Chennai",
        examples: "Zoho · Freshworks · Standard Chartered GCC",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹20–35 LPA" },
          { label: "FAANG density", range: "Low" },
          { label: "Cost of living", range: "Low (rent ₹12–25K/mo)" },
          { label: "Product co. density", range: "Medium" },
        ]
      },
    ]} />
  ),

  /* Strategy: mock-interview-importance-india-2026 */
  "mock-interview-importance-india-2026||Building a Mock Interview Practice Routine": (
    <PrepTimeline caption="Mock interview practice plan for Indian software engineers" phases={[
      { period: "Week 1–2", label: "Solo Practice", tasks: ["Solve LeetCode problems out loud — narrate every step", "Record yourself on phone; watch back for filler words", "Time each problem: 20 min easy, 35 min medium"], milestone: "Comfortable talking while coding" },
      { period: "Week 3–4", label: "Peer Mocks", tasks: ["Find 2–3 peers on HireStepX, Pramp, or InterviewBit", "Do 2 mocks per week: one as interviewee, one as interviewer", "Give and receive structured feedback on each mock"], milestone: "Completed 8 peer mock sessions" },
      { period: "Week 5–6", label: "AI + Company-Specific Mocks", tasks: ["Use AI mock tools for behavioural STAR practice", "Do company-tagged problem sets under strict time", "Simulate full 45-minute interview with intro + coding + questions"], milestone: "70%+ score across 5 consecutive mocks" },
    ]} />
  ),

  /* Strategy: product-manager-interview-india-2026 */
  "product-manager-interview-india-2026||PM Interview Dimensions at Indian Companies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Product Sense", hint: "Can you define a user problem, prioritise solutions, and describe a launch plan? Use Understand → Define → Prioritise → Launch framework." },
      { number: "02", label: "Analytics / Metrics", hint: "Can you set a north-star metric, build a funnel, and diagnose a metric drop? Indian PM interviews are metrics-heavy." },
      { number: "03", label: "Estimation", hint: "Market sizing and Fermi estimates. Practice: DAU of Google Pay India, GMV of Flipkart. Structure > precision." },
      { number: "04", label: "Execution", hint: "How do you manage stakeholders, handle trade-offs, and sequence a roadmap? Use RICE or MoSCoW framework." },
      { number: "05", label: "Behavioural", hint: "STAR stories about product wins, failures, influencing without authority, and managing scope creep." },
      { number: "06", label: "Technical Sufficiency", hint: "APIs, databases, system constraints — not deep code but enough to work with engineers. Especially tested at Flipkart and Razorpay." },
    ]} />
  ),
  "product-manager-interview-india-2026||Product Sense Questions: The Framework": (
    <PrepTimeline caption="8-week PM interview preparation plan for Indian candidates" phases={[
      { period: "Week 1–2", label: "Product Sense Foundations", tasks: ["Learn Understand-Define-Prioritise-Launch framework", "Practice 10 product design questions from Swiggy/PhonePe/Razorpay", "Read 5 PM teardowns of Indian consumer apps"], milestone: "Consistent structured product answers" },
      { period: "Week 3–4", label: "Metrics + Analytics", tasks: ["Practice north-star metric selection for 10 Indian products", "Learn funnel analysis + A/B testing basics", "Practice metric drop diagnosis: 5 scenarios"], milestone: "Can diagnose a metric drop in 4 minutes" },
      { period: "Week 5–6", label: "Estimation + Execution", tasks: ["10 Fermi estimate problems (DAU, GMV, market size)", "RICE prioritisation on 5 scenarios", "Stakeholder conflict: 3 STAR stories prepared"], milestone: "Estimation in under 3 minutes per question" },
      { period: "Week 7–8", label: "Mock Interviews", tasks: ["2 full-length PM mock interviews per week", "Behavioural bank: 8 STAR stories across all categories", "Research target company product deeply"], milestone: "Offer-ready across all 6 dimensions" },
    ]} />
  ),

  /* ── Remaining posts ── */

  /* Salary negotiation after offer */
  "salary-negotiation-after-job-offer-india-guide||Negotiation scripts and techniques": (
    <FrameworkSteps steps={[
      { number: "01", label: "Acknowledge the offer", hint: "Thank the recruiter sincerely and ask for 24–48 hours to review. Never negotiate on the spot — it signals desperation." },
      { number: "02", label: "State your number", hint: "Name your expected CTC confidently: \"Based on my research and experience, I was expecting ₹X. Is there flexibility?\"" },
      { number: "03", label: "Justify with data", hint: "Cite market ranges (Naukri, LinkedIn Salary, Glassdoor) and a competing offer if you have one. Don't just say \"I deserve more\"." },
      { number: "04", label: "Negotiate the full package", hint: "If base is fixed, negotiate joining bonus, variable %, ESOPs, notice period buyout, and WFH flexibility." },
    ]} />
  ),
  "salary-negotiation-after-job-offer-india-guide||What is negotiable beyond base salary": (
    <TierCompare cards={[
      { tier: "Service IT", examples: "TCS · Infosys · Wipro", rows: [{ label: "Base negotiability", range: "Low (band-fixed)" }, { label: "Joining bonus", range: "₹50K–2L (possible)" }] },
      { tier: "Product Startups", examples: "Swiggy · Razorpay · CRED", rows: [{ label: "Base negotiability", range: "High (±15%)" }, { label: "ESOPs", range: "Often negotiable" }] },
      { tier: "MNCs India", examples: "Microsoft · Amazon · Google", rows: [{ label: "Base negotiability", range: "Medium (±10%)" }, { label: "Signing bonus", range: "₹3–15L possible" }] },
    ]} />
  ),

  /* Side projects */
  "side-projects-portfolio-india-jobs-2026||What Makes a Side Project Actually Impressive": (
    <FrameworkSteps steps={[
      { number: "01", label: "Real problem solved", hint: "Projects that scratch a real itch outperform tutorial clones. Explain the problem you faced and why existing solutions failed you." },
      { number: "02", label: "Live and deployed", hint: "A working URL beats a GitHub link. Deploy on Vercel, Railway, or Render for free. Recruiters open URLs; they rarely clone repos." },
      { number: "03", label: "Production-quality code", hint: "Error handling, tests, environment variables handled properly, a clear README. These signal professional instincts." },
      { number: "04", label: "Measurable or growing", hint: "Real users or genuine metrics (even small) make a project tangible. 50 active users beats a polished demo with zero." },
    ]} />
  ),

  /* Remote work negotiation */
  "negotiating-remote-work-india-2026||When and How to Ask About Remote Work": (
    <FrameworkSteps steps={[
      { number: "01", label: "Time it right", hint: "Ask after you receive an offer — not during screening. Raising WFH requirements too early can screen you out before you've proven your value." },
      { number: "02", label: "Frame it as productivity", hint: "\"I do my deepest work remotely and have a well-equipped home office\" is stronger than \"I prefer working from home\"." },
      { number: "03", label: "Propose a structure", hint: "Offer a trial: \"I'm happy to come in for the first 30 days to ramp up, then move to 3 days in / 2 days remote.\" Structure lowers the risk for the employer." },
      { number: "04", label: "Get it in writing", hint: "Verbal WFH agreements disappear. Ask for the arrangement to be noted in your offer letter or a follow-up email." },
    ]} />
  ),

  /* Interview body language */
  "interview-body-language-india-2026||The Foundation: Posture and Physical Presence": (
    <FrameworkSteps steps={[
      { number: "01", label: "Sit at 90°", hint: "Back upright, feet flat on the floor. Slouching signals disengagement; leaning forward too much signals anxiety. 90° is neutral confidence." },
      { number: "02", label: "Open hands visible", hint: "Keep hands on the table or in view. Hidden hands read as concealment. Gestures when speaking are natural and positive — don't suppress them." },
      { number: "03", label: "Nod, don't over-nod", hint: "A single slow nod while listening signals understanding. Rapid nodding signals you want the interviewer to stop talking — the opposite of engaged." },
      { number: "04", label: "Pause before answering", hint: "A 1–2 second pause before your answer signals thoughtfulness, not uncertainty. Rushing to fill silence is the single most common interview mistake." },
    ]} />
  ),

  /* Optiver */
  "optiver-interview-questions-india-2026||The Optiver Interview Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Mental math (80 arithmetic problems in 8 min), personality test, numerical reasoning" },
      { label: "HireVue Video", duration: "30 min", detail: "Async behavioral questions — recorded, not live" },
      { label: "First Round", duration: "60 min", detail: "Mental math oral drill + probability puzzles + brain teasers" },
      { label: "Technical Round", duration: "90 min", detail: "Coding (Python/C++) + market-making scenarios + statistical reasoning" },
      { label: "Final Round", duration: "60 min", detail: "Culture fit + harder quant problems + P&L discussion" },
    ]} />
  ),
  "optiver-interview-questions-india-2026||Market Making and Quant Concepts for Optiver": (
    <FrameworkSteps steps={[
      { number: "01", label: "Bid-ask spread intuition", hint: "Understand why market makers profit from the spread and how inventory risk affects quotes. Practice explaining this without jargon." },
      { number: "02", label: "Probability under pressure", hint: "Expected value, Bayes' theorem, and conditional probability are tested verbally. Practice explaining your reasoning aloud, not just writing answers." },
      { number: "03", label: "Mental arithmetic speed", hint: "Target: 40+ correct in the 8-minute 80-question test. Practice daily with apps like Mental Math Master or the Zetamac arithmetic trainer." },
      { number: "04", label: "Options Greeks basics", hint: "Know Delta, Gamma, Theta, Vega conceptually. You're not expected to price complex derivatives, but intuition about how they move is tested." },
    ]} />
  ),

  /* Blockchain/Web3 */
  "blockchain-web3-jobs-india-2026||Blockchain Developer Salaries in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior Blockchain Dev (0–2 yr)", min: 8, max: 20 },
      { role: "Smart Contract Engineer (2–4 yr)", min: 18, max: 40 },
      { role: "Senior Web3 Engineer (4–7 yr)", min: 30, max: 65 },
      { role: "Blockchain Architect / Tech Lead", min: 50, max: 80 },
    ]} caption="India 2026 — Web3 salaries vary widely by company funding stage" />
  ),
  "blockchain-web3-jobs-india-2026||Technical Skills for Web3 Engineering in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Solidity + EVM fundamentals", hint: "ERC-20, ERC-721, storage layout, gas optimisation. HardHat and Foundry are the dominant testing frameworks at Indian Web3 companies." },
      { number: "02", label: "Layer 2 familiarity", hint: "Polygon (largest Indian Web3 employer) uses Polygon PoS and CDK. Understand optimistic vs ZK rollups conceptually." },
      { number: "03", label: "Backend integration", hint: "ethers.js/web3.js, indexing with The Graph, event listeners. Node.js backend skills transfer directly." },
      { number: "04", label: "Security awareness", hint: "Reentrancy, integer overflow, access control flaws — smart contract auditing awareness signals senior maturity." },
    ]} />
  ),

  /* HealthTech */
  "healthtech-jobs-india-2026||HealthTech Salary Benchmarks India 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 / Junior Engineer (0–2 yr)", min: 8, max: 18 },
      { role: "SDE-2 / Mid-level (2–5 yr)", min: 18, max: 35 },
      { role: "Senior Engineer (5–8 yr)", min: 30, max: 55 },
      { role: "Tech Lead / Staff Engineer", min: 45, max: 60 },
    ]} caption="Practo, PharmEasy, Pristyn Care, Medline India — 2026 ranges" />
  ),
  "healthtech-jobs-india-2026||Top HealthTech Employers in India 2026": (
    <TierCompare cards={[
      { tier: "Funded Scale-ups", examples: "PharmEasy · Practo · Pristyn Care", rows: [{ label: "SDE-1 range", range: "₹10–22 LPA" }, { label: "Growth stage", range: "Series D–F" }] },
      { tier: "Hospital Tech", examples: "Apollo Hospitals · Narayana Health", rows: [{ label: "SDE-1 range", range: "₹6–14 LPA" }, { label: "Stack", range: "Enterprise + cloud" }] },
      { tier: "Diagnostics Tech", examples: "Dr Lal PathLabs · Metropolis", rows: [{ label: "SDE-1 range", range: "₹7–15 LPA" }, { label: "Focus", range: "Data, integrations" }] },
    ]} />
  ),

  /* Frontend Engineer Role Guide */
  "frontend-engineer-interview-questions-india-2026||Frontend Engineer Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior Frontend (0–2 yr)", min: 5, max: 15 },
      { role: "Mid-level (2–5 yr)", min: 14, max: 30 },
      { role: "Senior Frontend (5–8 yr)", min: 25, max: 55 },
      { role: "Staff / Principal Engineer", min: 45, max: 70 },
    ]} caption="India 2026 — higher end at fintech and consumer internet" />
  ),
  "frontend-engineer-interview-questions-india-2026||React Interview Depth at Different Levels": (
    <TierCompare cards={[
      { tier: "SDE-1 (0–2 yr)", examples: "Junior Frontend roles", rows: [{ label: "Depth expected", range: "Hooks, lifecycle, props vs state" }, { label: "Common Q", range: "useEffect cleanup, key prop" }] },
      { tier: "SDE-2 (2–5 yr)", examples: "Mid-level roles", rows: [{ label: "Depth expected", range: "Performance, memoisation, context" }, { label: "Common Q", range: "reconciliation, Suspense, code-split" }] },
      { tier: "Senior (5+ yr)", examples: "Senior / Lead roles", rows: [{ label: "Depth expected", range: "Architecture, custom renderers, RSC" }, { label: "Common Q", range: "microfrontends, state at scale" }] },
    ]} />
  ),

  /* Resume tips */
  "resume-tips-software-engineer-india-2026||Writing Bullet Points That Get You Shortlisted": (
    <FrameworkSteps steps={[
      { number: "01", label: "Start with a strong verb", hint: "\"Built\", \"Reduced\", \"Led\", \"Designed\", \"Migrated\". Avoid passive constructions like \"Responsible for\" or \"Involved in\"." },
      { number: "02", label: "Add the scale", hint: "\"Reduced API latency\" is weak. \"Reduced API p99 latency from 800ms to 140ms for 2M daily active users\" is strong. Always add numbers." },
      { number: "03", label: "State the impact", hint: "What changed because of your work? Revenue? Conversion? Cost saving? Engineer count freed? Impact makes bullets scannable and memorable." },
      { number: "04", label: "Keep it one line", hint: "Two-line bullets are almost never read. If you need more space, split into two bullets. Recruiters spend 7 seconds on a first scan." },
    ]} />
  ),

  /* DevOps Engineer Role Guide */
  "devops-engineer-interview-questions-india-2026||DevOps Engineer Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior DevOps / SRE (0–2 yr)", min: 6, max: 16 },
      { role: "Mid-level DevOps (2–5 yr)", min: 15, max: 35 },
      { role: "Senior DevOps / SRE (5–8 yr)", min: 28, max: 60 },
      { role: "Staff SRE / Platform Lead", min: 45, max: 70 },
    ]} caption="India 2026 — SRE at product companies commands premium" />
  ),
  "devops-engineer-interview-questions-india-2026||CI/CD and GitOps for Indian DevOps Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pipeline stages", hint: "Source → Build → Test → Scan → Deploy → Monitor. Know each stage's failure modes and how to recover them automatically." },
      { number: "02", label: "GitOps fundamentals", hint: "Argo CD and Flux are the dominant tools at Indian product companies. Understand declarative vs imperative deployment and drift detection." },
      { number: "03", label: "Container security", hint: "Image scanning (Trivy, Snyk), non-root containers, read-only filesystems, secret management with Vault or AWS Secrets Manager." },
      { number: "04", label: "Observability wiring", hint: "Metrics (Prometheus), logs (Loki/ELK), traces (Jaeger). Know how to set SLOs and alert without alert fatigue." },
    ]} />
  ),

  /* Platform Engineer */
  "platform-engineer-interview-questions-india-2026||Platform Engineer Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Platform Engineer (2–4 yr)", min: 18, max: 35 },
      { role: "Senior Platform Engineer (4–7 yr)", min: 30, max: 60 },
      { role: "Staff Platform Engineer", min: 50, max: 80 },
    ]} caption="India 2026 — platform roles command 15–25% premium over SWE at same level" />
  ),
  "platform-engineer-interview-questions-india-2026||Platform Engineering Technical Skills for Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Internal developer platform", hint: "Backstage, Port, or custom IDP experience. Interviewers want to know if you've built self-service capabilities that reduced cognitive load for product engineers." },
      { number: "02", label: "Kubernetes at depth", hint: "Custom controllers, CRDs, admission webhooks, multi-cluster management. Platform roles go deeper than standard DevOps Kubernetes usage." },
      { number: "03", label: "Golden paths", hint: "How you define and enforce opinionated templates for services, CI pipelines, and infrastructure. Paved-road philosophy is a core platform engineering concept." },
      { number: "04", label: "Developer experience metrics", hint: "DORA metrics (deploy frequency, lead time, MTTR, change failure rate). Platform engineers own these — you need to know how to improve them." },
    ]} />
  ),

  /* EdTech */
  "edtech-jobs-india-2026||EdTech Engineering Salary Benchmarks India 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yr)", min: 8, max: 18 },
      { role: "SDE-2 (2–5 yr)", min: 16, max: 32 },
      { role: "Senior / Lead (5+ yr)", min: 28, max: 50 },
    ]} caption="PhysicsWallah, Unacademy, upGrad, BYJU's — 2026 ranges (post-edtech correction)" />
  ),
  "edtech-jobs-india-2026||Which EdTech Companies Are Stable in India in 2026": (
    <TierCompare cards={[
      { tier: "Stable / Growing", examples: "PhysicsWallah · upGrad · Classplus", rows: [{ label: "Cash flow", range: "Profitable or near" }, { label: "Hiring stance", range: "Selective growth" }] },
      { tier: "Recovery Mode", examples: "Unacademy · Vedantu", rows: [{ label: "Cash flow", range: "Restructured, leaner" }, { label: "Hiring stance", range: "Cautious" }] },
      { tier: "Avoid (risk)", examples: "BYJU's (legal/financial issues)", rows: [{ label: "Cash flow", range: "Distressed" }, { label: "Hiring stance", range: "Layoffs ongoing" }] },
    ]} />
  ),

  /* Fintech startups */
  "fintech-startup-jobs-india-2026||Compensation at Indian Fintech Startups 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yr)", min: 12, max: 25 },
      { role: "SDE-2 (2–5 yr)", min: 22, max: 45 },
      { role: "Senior Engineer (5+ yr)", min: 38, max: 60 },
    ]} caption="BharatPe, Slice, Fi Money, Jupiter, Setu — 2026 indicative ranges" />
  ),
  "fintech-startup-jobs-india-2026||How to Evaluate a Fintech Startup Before Joining": (
    <FrameworkSteps steps={[
      { number: "01", label: "Check runway and last round", hint: "Ask in the interview: \"When was your last funding round and what's your current runway?\" Series A+ with 18+ months runway is the minimum safe zone." },
      { number: "02", label: "Verify RBI licensing", hint: "Lending, payments, and insurance products need RBI/IRDAI/SEBI licenses. A startup without the right license is building on sand." },
      { number: "03", label: "Assess unit economics", hint: "Is the CAC declining? Is the cohort LTV improving? Good fintech has these numbers — ask if they can share directional data." },
      { number: "04", label: "Review engineer attrition", hint: "Check LinkedIn: how many engineers have left in the last 12 months? High attrition in engineering signals leadership or product problems." },
    ]} />
  ),

  /* Salary negotiation tips (software engineer specific) */
  "salary-negotiation-tips-india-software-engineer-2026||The Counter-Offer Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Anchor high, not extreme", hint: "Counter 15–20% above your target. Companies expect negotiation and bake in room. Anchoring at exactly your target leaves money on the table." },
      { number: "02", label: "Give a range, not a point", hint: "\"I'm looking for ₹28–32 LPA\" is more negotiable than \"I want ₹30 LPA\". The range signals flexibility while setting a floor." },
      { number: "03", label: "Justify once, then stop", hint: "State your market data. Then go quiet. Silence is powerful — recruiters are trained to fill it. Let them respond before you adjust." },
      { number: "04", label: "Negotiate all levers", hint: "If base is stuck, push on: joining bonus, variable payout guarantee (first year), ESOPs, and WFH days. These often have more flexibility than base." },
    ]} />
  ),
  "salary-negotiation-tips-india-software-engineer-2026||Five Mistakes That Will Cost You an Offer": (
    <TierCompare cards={[
      { tier: "Mistake: Anchoring low", examples: "Sharing your current CTC first", rows: [{ label: "Fix", range: "Deflect: \"I'd prefer to hear the range first\"" }] },
      { tier: "Mistake: Accepting verbally", examples: "Saying yes before seeing the letter", rows: [{ label: "Fix", range: "Always say \"Let me review the written offer\"" }] },
      { tier: "Mistake: Single-lever focus", examples: "Fighting only over base salary", rows: [{ label: "Fix", range: "Negotiate bonus, ESOPs, WFH, start date" }] },
    ]} />
  ),

  /* How to ace technical interview */
  "how-to-ace-technical-interview-india-2026||The 4-Week Technical Interview Preparation Plan": (
    <PrepTimeline caption="4-week interview prep plan" phases={[
      { period: "Week 1", label: "DSA Foundations", tasks: ["Arrays, strings, hashmaps: 15 LeetCode easy/medium", "Time/space complexity analysis for every solution", "Pick your primary language and practice its syntax"], milestone: "Consistent easy/medium in under 20 min" },
      { period: "Week 2", label: "Core Patterns", tasks: ["Two pointers, sliding window, BFS/DFS, binary search: 20 problems", "At least 1 hard problem daily — even a failed attempt teaches", "Practice explaining your approach out loud"], milestone: "Can articulate approach before coding" },
      { period: "Week 3", label: "System Design", tasks: ["Learn 4 core designs: URL shortener, rate limiter, notification service, feed", "Study CAP theorem, database selection, caching strategies", "Practice drawing and narrating design simultaneously"], milestone: "Any standard design in 40 min" },
      { period: "Week 4", label: "Mock Interviews", tasks: ["2 mock interviews (Pramp, Interviewing.io, or peer)", "Behavioral: 5 STAR stories covering ownership, conflict, failure, impact", "Research target companies' tech stacks and interview style"], milestone: "Offer-ready across all dimensions" },
    ]} />
  ),
  "how-to-ace-technical-interview-india-2026||The Think-Aloud Technique": (
    <FrameworkSteps steps={[
      { number: "01", label: "Repeat the problem", hint: "Restate the problem in your own words. This confirms understanding and gives you 30 seconds to think. Interviewers expect this." },
      { number: "02", label: "State your approach", hint: "Before writing a single line of code, say: \"My approach is X because Y.\" This is what separates candidates who get offers from those who don't." },
      { number: "03", label: "Code with commentary", hint: "Narrate what each section does as you write it. \"I'm using a hashmap here to get O(1) lookup instead of O(n) search...\"" },
      { number: "04", label: "Test with an example", hint: "Walk through your code with the example input before declaring it done. Catching your own bugs verbally scores far better than a silent wrong answer." },
    ]} />
  ),

  /* System design interview India */
  "system-design-interview-preparation-india-2026||The 6-Step System Design Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify requirements", hint: "Ask: functional requirements (what the system does), non-functional (scale, latency, consistency, availability). Spend 3–5 minutes here." },
      { number: "02", label: "Estimate scale", hint: "Back-of-envelope: users, requests/second, storage per day, bandwidth. Shows you think at production scale. Interviewers penalise skipping this." },
      { number: "03", label: "Define the API", hint: "Sketch 2–3 core API endpoints. This forces clarity on input/output before you start drawing boxes." },
      { number: "04", label: "High-level design", hint: "Draw: client, load balancer, app servers, database, cache, message queue. Explain each component's role and the data flow." },
      { number: "05", label: "Deep dive", hint: "The interviewer picks 1–2 components to drill. This is where you differentiate: schema, cache invalidation strategy, consistency model." },
      { number: "06", label: "Scale and trade-offs", hint: "How does the system handle 10x traffic? What breaks first? SQL vs NoSQL? Sync vs async? State trade-offs explicitly — there's no single right answer." },
    ]} />
  ),
  "system-design-interview-preparation-india-2026||Caching and Message Queue Architecture for Indian Tech Interviews": (
    <TierCompare cards={[
      { tier: "Caching Layer", examples: "Redis · Memcached · CDN", rows: [{ label: "What to know", range: "Cache-aside, write-through, TTL, eviction policies (LRU)" }, { label: "Common Q", range: "Cache invalidation, cache stampede, thundering herd" }] },
      { tier: "Message Queues", examples: "Kafka · RabbitMQ · SQS", rows: [{ label: "What to know", range: "Pub/sub, consumer groups, at-least-once vs exactly-once" }, { label: "Common Q", range: "Kafka partition strategy, dead-letter queues" }] },
      { tier: "Database Choice", examples: "PostgreSQL · Cassandra · DynamoDB", rows: [{ label: "What to know", range: "CAP theorem, ACID vs BASE, indexing, sharding strategies" }, { label: "Common Q", range: "When to denormalise, hot partition problem" }] },
    ]} />
  ),

  /* Best AI mock interview tools comparison */
  "best-ai-mock-interview-tools-india-2026||What actually matters when you're choosing one": (
    <ComparisonTable
      caption="Feature comparison across the tools covered below — pricing shown is the plan that unlocks full mock interview access, not a free-tier teaser."
      columns={[
        { name: "HireStepX", highlight: true },
        { name: "Interviewing.io" },
        { name: "Final Round AI" },
        { name: "Interview Warmup" },
        { name: "Verve / Yoodli / Big Interview" },
      ]}
      rows={[
        { label: "Voice practice", values: ["Yes", "Live human", "Yes", "Yes (basic)", "Varies"] },
        { label: "Pricing", values: ["Free start, INR/UPI", "$225+/session", "$148–225/mo (USD)", "Free", "Free tier + paid"] },
        { label: "India question bank", values: ["Deep (50+ companies)", "N/A", "Thin", "None", "Thin"] },
        { label: "Scored rubric feedback", values: ["Yes (STAR-based)", "Human feedback", "Yes", "No", "Varies"] },
        { label: "Best for", values: ["Indian company interviews", "High-stakes technical gut-check", "US company interviews", "One-off free warmup", "Delivery/communication polish"] },
      ]}
    />
  ),
  /* Early practice session data */
  "early-data-hirestepx-practice-sessions-2026||Behavioral rounds score lowest": (
    <ComparisonTable
      caption="Average overall score (0–100 rubric) on scored HireStepX practice sessions, by month. July is a partial month as of publication."
      columns={[
        { name: "HR round", highlight: true },
        { name: "Salary negotiation" },
        { name: "Behavioral" },
      ]}
      rows={[
        { label: "June 2026", values: ["55.3", "57.7", "51.0"] },
        { label: "July 2026 (partial)", values: ["78.0", "64.5", "55.0"] },
      ]}
    />
  ),

  "best-ai-mock-interview-tools-india-2026||Just using ChatGPT or Gemini directly": (
    <TierCompare cards={[
      { tier: "Campus / fresher", examples: "TCS NQT, Infosys InfyTQ, first job", rows: [{ label: "Pick", range: "HireStepX or Interview Warmup (free)" }] },
      { tier: "Experienced, targeting Indian companies", examples: "Product companies, GCCs, IT services", rows: [{ label: "Pick", range: "HireStepX — India-specific rubric + voice" }] },
      { tier: "Targeting US-headquartered companies", examples: "FAANG, US-based remote roles", rows: [{ label: "Pick", range: "Final Round AI or Interviewing.io" }] },
    ]} />
  ),
};
