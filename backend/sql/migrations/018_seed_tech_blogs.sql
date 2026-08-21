-- Migration 018: Seed additional tech blogs across new tech topics.
-- Authors: alice_writes (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12),
--          bob_codes   (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13)
-- Content is TipTap JSON: {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}

-- Helper is inline; each INSERT builds the doc JSON.

-- ============ NEW TOPIC: Quantum Computing ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'quantum-computing-explained',
'Quantum Computing Explained: Beyond Classical Bits',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Quantum computing harnesses the strange rules of quantum mechanics to process information in ways classical computers cannot. Instead of bits that are either 0 or 1, quantum computers use qubits, which can exist in a superposition of both states at once."}]},{"type":"paragraph","content":[{"type":"text","text":"Two phenomena give quantum computers their power: superposition and entanglement. Superposition lets qubits explore many possibilities simultaneously, while entanglement links qubits so the state of one instantly influences another, no matter the distance."}]},{"type":"paragraph","content":[{"type":"text","text":"Quantum computers will not replace your laptop. They excel at specific problems: simulating molecules for drug discovery, optimizing logistics, and breaking certain cryptographic schemes. For everyday tasks, classical computers remain faster and cheaper."}]},{"type":"paragraph","content":[{"type":"text","text":"We are still in the noisy intermediate-scale quantum era. Today''s machines have hundreds of qubits but high error rates. The race is on to build fault-tolerant quantum computers that can run long, complex algorithms reliably."}]}]}',
'Quantum computers use qubits, superposition, and entanglement to solve problems classical computers cannot.',
'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
7, 210, 'published', NOW() - INTERVAL '2 days', 342, 41, 6, false, '["Quantum Computing","Technology"]', 41, 3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'getting-started-with-qiskit',
'Getting Started with Qiskit: Your First Quantum Circuit',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Qiskit is IBM''s open-source framework for quantum computing. With just Python, you can build and run quantum circuits on real quantum hardware through the cloud."}]},{"type":"paragraph","content":[{"type":"text","text":"A quantum circuit is a sequence of quantum gates applied to qubits. The Hadamard gate puts a qubit into superposition, while the CNOT gate entangles two qubits. Combining these simple gates lets you build powerful quantum algorithms."}]},{"type":"paragraph","content":[{"type":"text","text":"Start with the Bell state: apply a Hadamard to the first qubit, then a CNOT with the first qubit as control and the second as target. Measuring both qubits will always give correlated results, demonstrating entanglement."}]},{"type":"paragraph","content":[{"type":"text","text":"Qiskit abstracts away the physics so you can focus on algorithms. As quantum hardware matures, the skills you build today will transfer directly to tomorrow''s fault-tolerant machines."}]}]}',
'Build and run your first quantum circuit using IBM''s open-source Qiskit framework.',
'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&q=80',
6, 185, 'published', NOW() - INTERVAL '1 day', 198, 27, 4, false, '["Quantum Computing","Programming"]', 27, 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ============ NEW TOPIC: Edge Computing ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'edge-computing-future-of-cloud',
'Edge Computing: Why the Future of Cloud Is at the Edge',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edge computing moves computation and data storage closer to where data is generated, rather than relying on a centralized data center thousands of miles away. This reduces latency and bandwidth usage dramatically."}]},{"type":"paragraph","content":[{"type":"text","text":"Consider a self-driving car. It cannot afford to send sensor data to the cloud and wait for a response before braking. The computation must happen at the edge, on the vehicle itself, in milliseconds."}]},{"type":"paragraph","content":[{"type":"text","text":"Edge computing is not a replacement for the cloud but a complement. The cloud handles heavy training and long-term storage, while the edge handles real-time inference and immediate decisions."}]},{"type":"paragraph","content":[{"type":"text","text":"From smart factories to content delivery networks, edge computing is reshaping architecture. Understanding when to compute at the edge versus the cloud is becoming a core skill for modern engineers."}]}]}',
'Edge computing brings computation closer to data sources, cutting latency for real-time applications.',
'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
6, 190, 'published', NOW() - INTERVAL '3 days', 256, 33, 5, false, '["Edge Computing","Technology"]', 33, 2, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- ============ NEW TOPIC: Kubernetes ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'kubernetes-for-beginners',
'Kubernetes for Beginners: A Gentle Introduction',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kubernetes, often called K8s, is an open-source platform for automating the deployment, scaling, and management of containerized applications. It was originally developed by Google and is now maintained by the Cloud Native Computing Foundation."}]},{"type":"paragraph","content":[{"type":"text","text":"At its core, Kubernetes groups containers into pods, the smallest deployable units. It ensures the right number of pods are running, restarts them if they fail, and distributes them across your cluster of machines."}]},{"type":"paragraph","content":[{"type":"text","text":"Key concepts include Deployments, which manage replica sets of pods; Services, which provide networking and load balancing; and ConfigMaps and Secrets, which externalize configuration from your containers."}]},{"type":"paragraph","content":[{"type":"text","text":"Kubernetes has a steep learning curve, but it pays off. It gives you self-healing infrastructure, horizontal scaling, and declarative configuration. Start small with a local cluster like Minikube or kind before moving to production."}]}]}',
'Learn the core concepts of Kubernetes: pods, deployments, services, and declarative configuration.',
'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80',
8, 230, 'published', NOW() - INTERVAL '4 days', 411, 52, 9, false, '["Kubernetes","DevOps"]', 52, 5, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');

INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'kubernetes-vs-docker-swarm',
'Kubernetes vs Docker Swarm: Which Orchestrator Should You Choose?',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Both Kubernetes and Docker Swarm orchestrate containers, but they target different needs. Swarm is built into Docker and is remarkably simple to set up. Kubernetes is more complex but far more powerful and feature-rich."}]},{"type":"paragraph","content":[{"type":"text","text":"Docker Swarm shines for small teams and simple applications. You can have a cluster running in minutes with familiar Docker commands. The learning curve is gentle, and for many workloads it is more than enough."}]},{"type":"paragraph","content":[{"type":"text","text":"Kubernetes dominates when you need advanced features: fine-grained autoscaling, sophisticated networking policies, a vast ecosystem of tools, and strong community support. It is the de facto standard for large-scale production systems."}]},{"type":"paragraph","content":[{"type":"text","text":"The honest answer is that most organizations have standardized on Kubernetes. But do not dismiss Swarm for smaller projects. Choose the tool that matches your team size, complexity, and operational capacity."}]}]}',
'Compare Kubernetes and Docker Swarm to choose the right container orchestrator for your needs.',
'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800&q=80',
7, 205, 'published', NOW() - INTERVAL '5 days', 289, 31, 6, false, '["Kubernetes","DevOps","Docker"]', 31, 2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');

-- ============ NEW TOPIC: Rust ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'why-rust-is-loved',
'Why Rust Is the Most Loved Programming Language',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rust has topped Stack Overflow''s most loved language survey for years running. The reason is simple: it delivers memory safety without a garbage collector, giving you the performance of C++ with far fewer bugs."}]},{"type":"paragraph","content":[{"type":"text","text":"Rust''s secret weapon is the borrow checker. It enforces rules about ownership and borrowing at compile time, eliminating entire classes of bugs like null pointer dereferences, data races, and use-after-free errors before your code ever runs."}]},{"type":"paragraph","content":[{"type":"text","text":"The learning curve is real. Fighting the borrow checker can be frustrating at first. But developers who push through describe a moment where it clicks, and suddenly they write code that is both fast and correct by construction."}]},{"type":"paragraph","content":[{"type":"text","text":"Rust is used in production at Mozilla, Dropbox, Cloudflare, and Amazon. It powers everything from operating systems to web assembly to blockchain. If you care about performance and reliability, Rust is worth your time."}]}]}',
'Rust delivers memory safety without a garbage collector, making it fast and reliable.',
'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
7, 215, 'published', NOW() - INTERVAL '6 days', 367, 48, 11, false, '["Rust","Programming"]', 48, 4, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days');

INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'rust-ownership-explained',
'Rust Ownership Explained: The Key to Memory Safety',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ownership is Rust''s most unique feature and the foundation of its memory safety guarantees. Every value in Rust has a single owner, and when the owner goes out of scope, the value is dropped automatically."}]},{"type":"paragraph","content":[{"type":"text","text":"There are three core rules. Each value has exactly one owner. There can only be one owner at a time. When the owner goes out of scope, the value is dropped. These rules are enforced at compile time, so there is no runtime cost."}]},{"type":"paragraph","content":[{"type":"text","text":"Borrowing lets you reference a value without taking ownership. You can have many immutable references or exactly one mutable reference, but never both at once. This prevents data races at compile time."}]},{"type":"paragraph","content":[{"type":"text","text":"Ownership feels restrictive at first, but it forces you to think clearly about who owns your data. That clarity eliminates bugs and makes concurrent code dramatically safer. It is a different way of thinking, and it is worth learning."}]}]}',
'Master Rust''s ownership system, the foundation of its compile-time memory safety.',
'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&q=80',
7, 200, 'published', NOW() - INTERVAL '7 days', 298, 36, 7, false, '["Rust","Programming"]', 36, 3, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');

-- ============ NEW TOPIC: TypeScript ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'typescript-tips-for-javascript-developers',
'10 TypeScript Tips for JavaScript Developers',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Moving from JavaScript to TypeScript can feel overwhelming, but you do not need to learn everything at once. These practical tips will help you get the most out of TypeScript from day one."}]},{"type":"paragraph","content":[{"type":"text","text":"Start by letting TypeScript infer types. You do not need to annotate everything. Write your JavaScript as usual and let the compiler figure out the types. Only add annotations where inference falls short or where you want extra clarity."}]},{"type":"paragraph","content":[{"type":"text","text":"Embrace union types and type narrowing. Instead of any, use string or number to describe values that can be one of several types. Then use typeof checks and control flow to narrow the type safely."}]},{"type":"paragraph","content":[{"type":"text","text":"Use interfaces for object shapes and type aliases for unions and computed types. Enable strict mode in your tsconfig. It catches more bugs and the short-term pain pays long-term dividends in code quality."}]}]}',
'Practical TypeScript tips to help JavaScript developers write safer, clearer code.',
'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?w=800&q=80',
6, 195, 'published', NOW() - INTERVAL '8 days', 423, 55, 12, false, '["TypeScript","Web Development","Programming"]', 55, 6, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');

INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'advanced-typescript-generics',
'Advanced TypeScript: Mastering Generics',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Generics are one of TypeScript''s most powerful features, letting you write reusable code that works across many types while preserving type safety. They are everywhere in library code, and understanding them unlocks advanced patterns."}]},{"type":"paragraph","content":[{"type":"text","text":"A generic function uses a type parameter, often called T, as a placeholder. When you call the function, TypeScript infers or you specify the actual type. The function then works with that specific type throughout."}]},{"type":"paragraph","content":[{"type":"text","text":"Constraints let you limit what types a generic accepts. Using extends, you can require that a type has certain properties. This gives you flexibility while still guaranteeing the operations you need are available."}]},{"type":"paragraph","content":[{"type":"text","text":"Conditional types and mapped types build on generics to perform type-level computation. They are advanced, but they power utility types like Partial, Pick, and Record that you use every day."}]}]}',
'Unlock the full power of TypeScript generics, constraints, and type-level programming.',
'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=800&q=80',
8, 220, 'published', NOW() - INTERVAL '9 days', 312, 40, 8, false, '["TypeScript","Web Development"]', 40, 3, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days');

-- ============ NEW TOPIC: System Design ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'system-design-fundamentals',
'System Design Fundamentals: How to Think About Scale',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"System design is the art of building systems that handle scale, stay reliable, and remain maintainable. It is less about specific technologies and more about trade-offs and thinking through constraints."}]},{"type":"paragraph","content":[{"type":"text","text":"Start with the fundamentals: understand your requirements, estimate your scale, and identify bottlenecks. How many users? How much data? What latency is acceptable? These questions shape every decision that follows."}]},{"type":"paragraph","content":[{"type":"text","text":"Core building blocks include load balancers to distribute traffic, caches to reduce database load, databases with replication for reliability, and message queues to decouple components. Know when and why to reach for each."}]},{"type":"paragraph","content":[{"type":"text","text":"There is no perfect design, only the right design for your constraints. Every choice involves trade-offs between consistency, availability, latency, and cost. Great system designers make these trade-offs explicit and deliberate."}]}]}',
'Learn the core principles of system design: scale estimation, building blocks, and trade-offs.',
'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
8, 225, 'published', NOW() - INTERVAL '10 days', 512, 68, 14, false, '["System Design","Software Engineering"]', 68, 7, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'caching-strategies-explained',
'Caching Strategies Explained: From Browser to CDN',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Caching is one of the most effective ways to improve performance, but it is also one of the easiest to get wrong. The right caching strategy depends on your data, your access patterns, and your consistency requirements."}]},{"type":"paragraph","content":[{"type":"text","text":"Caching happens at many layers. The browser caches static assets. A CDN caches content at the edge, close to users. Application-level caches like Redis store computed results. Database query caches avoid repeated work."}]},{"type":"paragraph","content":[{"type":"text","text":"Common strategies include cache-aside, where the application checks the cache before the database; write-through, where writes go to both; and write-behind, where writes go to the cache first and sync later."}]},{"type":"paragraph","content":[{"type":"text","text":"The hard part is invalidation. Stale cache serves outdated data, so you need a strategy: time-to-live expiration, explicit invalidation on writes, or versioning. As the saying goes, cache invalidation is one of the hard problems in computer science."}]}]}',
'Master caching strategies across every layer, from browser cache to CDN to Redis.',
'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80',
8, 215, 'published', NOW() - INTERVAL '11 days', 356, 44, 9, false, '["System Design","Web Development"]', 44, 4, NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days');

-- ============ NEW TOPIC: GraphQL ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'graphql-vs-rest',
'GraphQL vs REST: When to Use Each',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"GraphQL and REST are two different approaches to building APIs, and the debate between them is often overhyped. The truth is that each has strengths, and the right choice depends on your specific needs."}]},{"type":"paragraph","content":[{"type":"text","text":"REST is simple, cacheable, and well-understood. Each resource has a URL, and you use HTTP verbs to interact with it. For straightforward CRUD applications, REST is often the fastest path to a working API."}]},{"type":"paragraph","content":[{"type":"text","text":"GraphQL shines when clients need flexibility. Instead of multiple endpoints, you have a single endpoint where clients request exactly the fields they need. This eliminates over-fetching and under-fetching, a common REST pain point."}]},{"type":"paragraph","content":[{"type":"text","text":"The trade-offs matter. GraphQL adds complexity, makes caching harder, and can enable expensive queries if not guarded. REST is simpler but can lead to many round trips. Choose based on your team, your clients, and your data model."}]}]}',
'Understand the real trade-offs between GraphQL and REST to pick the right API style.',
'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
7, 210, 'published', NOW() - INTERVAL '12 days', 389, 47, 10, false, '["GraphQL","Web Development","API"]', 47, 5, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days');

-- ============ NEW TOPIC: WebAssembly ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'webassembly-browser-future',
'WebAssembly: The Future of High-Performance Web Apps',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"WebAssembly, or Wasm, is a binary instruction format that runs in the browser at near-native speed. It lets you run code written in languages like Rust, C++, and Go directly in the web browser alongside JavaScript."}]},{"type":"paragraph","content":[{"type":"text","text":"WebAssembly is not meant to replace JavaScript but to complement it. JavaScript remains great for UI and logic, while Wasm handles compute-intensive tasks like image processing, games, and scientific simulations."}]},{"type":"paragraph","content":[{"type":"text","text":"Real-world uses are already here. Figma uses WebAssembly for its design tool performance. AutoCAD runs in the browser thanks to Wasm. Video editing, 3D rendering, and even machine learning inference are moving to the browser."}]},{"type":"paragraph","content":[{"type":"text","text":"The ecosystem is maturing fast. Tools like wasm-pack make it easy to compile Rust to Wasm. The component model promises to make Wasm modules interoperable beyond the browser, extending its reach to servers and edge computing."}]}]}',
'WebAssembly brings near-native performance to the browser for compute-intensive applications.',
'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80',
7, 205, 'published', NOW() - INTERVAL '13 days', 274, 35, 6, false, '["WebAssembly","Web Development","Rust"]', 35, 3, NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days');

-- ============ NEW TOPIC: Go ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'go-concurrency-patterns',
'Go Concurrency Patterns: Goroutines and Channels',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Go''s approach to concurrency is one of its defining features. Instead of threads and locks, Go gives you goroutines and channels, making concurrent code easier to write and reason about."}]},{"type":"paragraph","content":[{"type":"text","text":"A goroutine is a lightweight thread managed by the Go runtime. You can spawn thousands of them without breaking a sweat. Just prefix a function call with the go keyword and it runs concurrently."}]},{"type":"paragraph","content":[{"type":"text","text":"Channels are the pipes that connect goroutines. They let you pass values between goroutines safely, without explicit locks. The philosophy is: do not communicate by sharing memory; share memory by communicating."}]},{"type":"paragraph","content":[{"type":"text","text":"Common patterns include worker pools for parallel processing, pipelines for streaming data through stages, and select statements for handling multiple channels. Mastering these patterns unlocks Go''s full potential for building fast, concurrent systems."}]}]}',
'Learn Go''s concurrency model: goroutines, channels, and patterns like worker pools.',
'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
7, 200, 'published', NOW() - INTERVAL '14 days', 321, 39, 7, false, '["Go","Programming"]', 39, 4, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- ============ NEW TOPIC: Python ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'python-performance-tips',
'Python Performance Tips: Writing Faster Code',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Python is loved for its readability, not its speed. But with the right techniques, you can make your Python code dramatically faster without sacrificing clarity."}]},{"type":"paragraph","content":[{"type":"text","text":"Start with the basics: use built-in functions and libraries, which are implemented in C and heavily optimized. List comprehensions are faster than explicit loops. Generator expressions save memory for large datasets."}]},{"type":"paragraph","content":[{"type":"text","text":"Choose the right data structures. Use sets for membership testing, dicts for lookups, and deque for queue operations. The difference between O(1) and O(n) operations compounds quickly in loops."}]},{"type":"paragraph","content":[{"type":"text","text":"For serious performance, reach for NumPy for numerical work, or consider multiprocessing to use multiple CPU cores. And when all else fails, profile first. Measure where time is actually spent before optimizing blindly."}]}]}',
'Practical techniques to make your Python code faster without losing readability.',
'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&q=80',
6, 190, 'published', NOW() - INTERVAL '15 days', 445, 51, 11, false, '["Python","Programming"]', 51, 5, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days');

-- ============ NEW TOPIC: Serverless ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'serverless-architecture-guide',
'Serverless Architecture: A Practical Guide',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Serverless computing lets you run code without managing servers. You write functions, deploy them, and the cloud provider handles scaling, patching, and infrastructure. You pay only for the compute time you actually use."}]},{"type":"paragraph","content":[{"type":"text","text":"AWS Lambda pioneered the model, but all major clouds now offer serverless functions. They shine for event-driven workloads: processing uploads, handling webhooks, scheduled tasks, and APIs with variable traffic."}]},{"type":"paragraph","content":[{"type":"text","text":"The benefits are real: no server management, automatic scaling, and a pay-per-use cost model that can be very cheap for sporadic workloads. But there are trade-offs, including cold start latency and vendor lock-in."}]},{"type":"paragraph","content":[{"type":"text","text":"Serverless is not a silver bullet. Long-running tasks, predictable high traffic, and applications needing fine control may be better served by containers or VMs. Match the architecture to the workload."}]}]}',
'Understand when serverless architecture makes sense and how to build with it.',
'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80',
7, 200, 'published', NOW() - INTERVAL '16 days', 287, 34, 6, false, '["Serverless","Cloud Computing","DevOps"]', 34, 3, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days');

-- ============ NEW TOPIC: Cloud Computing ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'aws-vs-azure-vs-gcp',
'AWS vs Azure vs Google Cloud: A Practical Comparison',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The big three cloud providers, AWS, Azure, and Google Cloud, dominate the market. Each offers hundreds of services, but they differ in strengths, pricing, and philosophy. Choosing between them is a common challenge."}]},{"type":"paragraph","content":[{"type":"text","text":"AWS is the market leader with the broadest service catalog and the most mature ecosystem. It is the safe, default choice for many organizations, though its sheer breadth can be overwhelming."}]},{"type":"paragraph","content":[{"type":"text","text":"Azure integrates seamlessly with Microsoft products, making it the natural choice for enterprises already invested in Windows, Office, and Active Directory. Its hybrid cloud story is particularly strong."}]},{"type":"paragraph","content":[{"type":"text","text":"Google Cloud excels at data analytics, machine learning, and Kubernetes, which it invented. It is often the most developer-friendly and price-competitive. The honest answer is that multi-cloud and your existing stack matter more than benchmarks."}]}]}',
'Compare AWS, Azure, and Google Cloud across services, pricing, and ecosystem strengths.',
'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80',
7, 210, 'published', NOW() - INTERVAL '17 days', 398, 46, 9, false, '["Cloud Computing","DevOps","Technology"]', 46, 4, NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days');

-- ============ NEW TOPIC: IoT ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'iot-security-challenges',
'IoT Security: The Biggest Challenges and How to Solve Them',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The Internet of Things connects billions of devices, from smart thermostats to industrial sensors. But this connectivity creates a massive attack surface, and IoT security remains one of the industry''s biggest challenges."}]},{"type":"paragraph","content":[{"type":"text","text":"Many IoT devices ship with weak default passwords, no encryption, and no way to update firmware. They are built to be cheap and small, which often means security is an afterthought."}]},{"type":"paragraph","content":[{"type":"text","text":"The consequences are serious. Compromised IoT devices have been used in massive botnet attacks like Mirai, which knocked major websites offline. Insecure cameras and smart home devices can also expose your privacy."}]},{"type":"paragraph","content":[{"type":"text","text":"Solutions include secure boot, encrypted communication, regular firmware updates, and network segmentation to isolate IoT devices. As a consumer, change default passwords and keep devices updated. As a builder, design security in from the start."}]}]}',
'Explore the unique security challenges of IoT devices and how to address them.',
'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
7, 200, 'published', NOW() - INTERVAL '18 days', 264, 32, 5, false, '["IoT","Cybersecurity","Technology"]', 32, 2, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days');

-- ============ NEW TOPIC: API ============
INSERT INTO posts (author_id, slug, title, content, excerpt, cover_image_url, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, tags, clap_count, repost_count, created_at, updated_at)
VALUES (
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'api-design-best-practices',
'API Design Best Practices: Building APIs Developers Love',
'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A well-designed API is a joy to use; a poorly designed one is a constant source of frustration. Good API design is about consistency, clarity, and respecting the developers who will build on top of your work."}]},{"type":"paragraph","content":[{"type":"text","text":"Start with the basics: use nouns for resources, not verbs. Use plural names consistently, like /users not /user. Use HTTP methods correctly: GET for reads, POST for creates, PUT or PATCH for updates, DELETE for removals."}]},{"type":"paragraph","content":[{"type":"text","text":"Version your API from day one, typically with a version in the URL like /v1/. Provide clear error messages with proper status codes. And paginate large result sets to keep responses fast."}]},{"type":"paragraph","content":[{"type":"text","text":"Documentation is part of the API. Developers should be able to understand your API without reading your source code. Invest in clear examples, and consider standards like OpenAPI to generate docs and client libraries automatically."}]}]}',
'Learn the principles of great API design: consistency, versioning, and clear errors.',
'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
7, 205, 'published', NOW() - INTERVAL '19 days', 334, 42, 8, false, '["API","Web Development","Software Engineering"]', 42, 4, NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days');
