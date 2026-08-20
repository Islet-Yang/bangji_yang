---
layout: post
title: "BCR and CCR: concurrent reasoning as a scaling axis"
date: 2026-05-09 12:00:00-0500
description: A technical note on shared-context reinforcement, implicit token budgets, and concurrency scaling for efficient reasoning models.
tags: reasoning reinforcement-learning efficient-inference scaling-law
categories: research
thumbnail: assets/img/posts/bcr/ccr-pipeline.png
related_posts: false
toc:
  sidebar: left
---

Long chain-of-thought reasoning has become one of the most reliable ways to improve mathematical problem solving in language models. But it comes with a deployment problem that is easy to hide in benchmark tables: the unit of evaluation is usually one problem, while the unit of deployment cost is generated tokens. A model can solve a problem correctly and still waste thousands of tokens on repeated verification, unnecessary narration, or exploratory branches that do not change the final answer.

This post is a technical synthesis of two connected projects:

| Work                                                 | Status                    | Main question                                                                   | Public artifacts                                        |
| ---------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Batched Contextual Reinforcement (BCR)**           | accepted to **ICML 2026** | Can multi-problem training induce shorter reasoning at ordinary inference time? | [arXiv:2604.02322](https://arxiv.org/pdf/2604.02322)    |
| **Concurrent Constraint Reinforcement (CCR / BCR2)** | submitted to **NeurIPS**  | How should the best concurrent task count scale with model capability?          | arXiv coming soon; Hugging Face checkpoints coming soon |

The two papers share the same basic belief:

> Efficient reasoning should emerge from the structure of the optimization environment, not from a hand-designed instruction to be short.

BCR is the discovery layer. It shows that asking a model to solve multiple problems in one shared context during RL training creates an implicit resource constraint, and that the resulting policy remains more token-efficient even when evaluated on ordinary single-problem prompts. CCR is the mechanism and scaling layer. It formalizes the shared budget as a constrained RL objective, explains why grouped rewards can improve statistical stability, and studies how the optimal concurrent task count grows with model capability.

{% include figure.liquid loading="eager" path="assets/img/posts/bcr/ccr-pipeline.png" title="CCR pipeline" class="img-fluid rounded z-depth-1" %}

<div class="caption">
CCR turns a group of problems into one shared-context rollout. The model emits one ordered completion, a parser extracts answers, and the reward is average correctness under a hard generation budget.
</div>

## 1. The bottleneck: solved problems per token

Let a reasoning model receive a problem $$q$$ and produce a completion $$y$$. Standard RLVR-style training optimizes correctness:

$$
R(y, q) = \mathbf{1}\{\mathrm{answer}(y) = a(q)\}.
$$

This objective is clean, scalable, and attractive because math answers are often verifiable. But it is indifferent to how many tokens were required to reach the answer. If two trajectories are both correct, one using 2,000 tokens and the other using 20,000 tokens, the reward does not distinguish them.

The naive fix is to add a length penalty:

$$
R_{\lambda}(y, q) =
\mathbf{1}\{\mathrm{answer}(y) = a(q)\}
- \lambda L(y),
$$

where $$L(y)$$ is output length. This looks reasonable, but it changes the optimization geometry in a dangerous way. Every token receives a negative marginal signal, including tokens that are necessary for a correct derivation. The model is asked to optimize two competing objectives at every generation step: reason enough to be correct, but stop as early as possible. In RL, that conflict can collapse into degenerate brevity.

BCR and CCR take a different route. Instead of directly penalizing tokens, they make tokens a shared resource.

## 2. BCR: a structural constraint, not a length reward

In BCR, the model is trained on groups of $$N$$ problems. A group is

$$
G = \{(q_1, a_1), (q_2, a_2), \ldots, (q_N, a_N)\}.
$$

The model receives all $$N$$ problems in one prompt and produces one joint completion. The reward is still accuracy-based, computed at the problem level. Conceptually, a completion receives credit for the answers it gets right:

$$
r_{\mathrm{acc}}(y, G)
=
\frac{1}{N}
\sum_{i=1}^{N}
\mathbf{1}\{\hat{a}_i(y) = a_i\}.
$$

There is no explicit length term. The key pressure comes from the fact that the group shares one context and one output budget. Tokens spent on problem $$i$$ are not bad by themselves, but they can prevent the model from completing problem $$j$$. This creates a form of resource competition that is adaptive: useful reasoning survives, while redundant reasoning becomes expensive only when it displaces other useful work.

This difference is subtle but central. A length penalty says: "every token is costly." BCR says: "tokens are costly only when they crowd out answers."

## 3. The BCR training objective

BCR can be implemented with a group-relative RL objective such as GRPO. For a fixed group $$G$$, sample $$S$$ joint completions:

$$
y_j \sim \pi_{\theta}(\cdot \mid G),
\quad j = 1,\ldots,S.
$$

Each completion receives reward $$R_j$$. The group-relative advantage is

$$
A_j
=
R_j
-
\frac{1}{S}\sum_{s=1}^{S} R_s.
$$

The resulting policy-gradient direction is approximately

$$
\hat{g}_{\mathrm{BCR}}(G)
=
\frac{1}{S}
\sum_{j=1}^{S}
A_j \nabla_{\theta}\log \pi_{\theta}(y_j \mid G)
-
\beta \nabla_{\theta}D_{\mathrm{KL}}(\pi_{\theta}\Vert\pi_{\mathrm{ref}}).
$$

The only structural difference from standard single-problem RLVR is the unit of rollout: a trajectory now contains several problems that compete for the same budget. This is why BCR is easy to compose with existing RL pipelines. It does not require a learned difficulty estimator, a process reward, a multi-stage curriculum, or a special decoding policy.

## 4. BCR1 result: efficiency transfers back to ordinary inference

The strict test for BCR is not batched inference. It is ordinary single-problem inference. If a model is trained with grouped prompts but only becomes efficient when evaluated with grouped prompts, the method would be a deployment trick. BCR1 shows something stronger: the reasoning policy itself changes.

At $$N=1$$ inference, BCR reduces token usage substantially:

- Against JustRL-DeepSeek-1.5B, token usage drops by **39.8% to 62.6%** across five math benchmarks.
- Against Qwen3-4B-Thinking-2507, token usage drops by **15.8% to 31.8%**.
- For the 4B model, accuracy improves on all five reported benchmarks while tokens decrease on all five.

{% include figure.liquid path="assets/img/posts/bcr/bcr1-main-table.jpg" title="BCR1 main table" class="img-fluid rounded z-depth-1" %}

<div class="caption">
BCR1 main results at standard single-problem inference. Efficiency learned from multi-problem training transfers back to ordinary $$N=1$$ use.
</div>

The most useful way to read this table is not as a simple speedup. The stronger claim is that some reasoning tokens in the baseline are not buying accuracy. BCR removes part of the low-value reasoning mass: repeated self-checks, discarded solution attempts, and explanatory filler inherited from instruction data.

This is why the paper calls the result a "free lunch" in some regimes. For Qwen3-4B-Thinking-2507, the model becomes both more accurate and shorter. On AIME25, accuracy rises from 70.0% to 83.3% while token count falls from 20,773 to 17,498. The point is not that shorter is always better. The point is that standard single-problem training often leaves the model in an over-deliberative policy basin.

## 5. Inference-time task scaling

BCR1 also studies what happens when the model is asked to solve multiple problems at inference time. Let $$N$$ denote the number of concurrent problems in a single shared-context completion. The observed behavior is:

$$
N \uparrow
\quad \Longrightarrow \quad
\mathrm{tokens\ per\ problem} \downarrow.
$$

The baseline also becomes shorter as $$N$$ grows, but it compresses indiscriminately and loses accuracy quickly. BCR degrades more gracefully because it has already learned how to allocate reasoning under shared pressure.

This gives $$N$$ a new role. It is no longer just a data batching parameter. It becomes an inference-time throughput knob. A practitioner can choose a larger $$N$$ when cost or latency matters, and a smaller $$N$$ when maximum per-problem accuracy matters.

{% include figure.liquid path="assets/img/posts/bcr/bcr1-pareto.png" title="BCR1 Pareto frontier" class="img-fluid rounded z-depth-1" %}

<div class="caption">
BCR1 pushes the accuracy-token frontier toward lower token usage without the training collapse seen under direct length minimization.
</div>

The qualitative traces support the same interpretation. BCR does not usually remove mathematical steps. It removes syntactic waste:

1. **Metacognitive loops.** Repeated "wait, let me re-check" passages are reduced when they do not change the proof.
2. **Redundant strategy search.** The model commits earlier to a useful solution path.
3. **Pedagogical narration.** The model stops explaining basic facts to itself.
4. **Degenerate tails.** The model is less likely to exhaust the full context window and drift into repetitive output.

{% include figure.liquid path="assets/img/posts/bcr/bcr1-case-study.jpg" title="BCR1 qualitative case study" class="img-fluid rounded z-depth-1" %}

<div class="caption">
A BCR1 qualitative example. The compressed trace keeps the essential mathematical move while removing low-value exploration and narration.
</div>

## 6. Why hard constraints beat soft penalties

The ablation in BCR1 compares the implicit shared-budget method with explicit length penalties. A simplified explicit penalty objective is:

$$
R_{\lambda}(y, G)
=
r_{\mathrm{acc}}(y, G)
-
\lambda \frac{L(y)}{L_{\max}}.
$$

This makes every token locally negative. If the length term becomes too influential, the model can improve the reward by producing shorter and shorter completions, even when they are wrong or unparsable. BCR's hard budget behaves differently:

$$
L(y) \leq B_{\max}.
$$

Within the budget, a useful token is not punished. The model can spend tokens on a difficult algebraic derivation or geometry invariant if doing so improves correctness. But if the token budget binds, low-value verbosity can displace another answer and reduce group reward.

{% include figure.liquid path="assets/img/posts/bcr/bcr1-implicit-vs-explicit.jpg" title="Implicit versus explicit length control" class="img-fluid rounded z-depth-1" %}

<div class="caption">
Explicit length penalties optimize for brevity at the cost of correctness. The implicit shared-budget version remains stable because useful reasoning tokens are not directly penalized.
</div>

This result is one of the most important design lessons from BCR1. For RL-based reasoning, efficiency is safer as a **constraint** than as a **per-token reward term**.

## 7. CCR: making the constraint explicit

CCR takes the BCR mechanism and formalizes it as concurrent constrained reinforcement. The group is again

$$
G = \{q_1,\ldots,q_N\}.
$$

The model produces one ordered completion $$y$$, the parser extracts $$N$$ answers, and the reward combines final-answer accuracy with format validity:

$$
R(y, G)
=
w_{\mathrm{acc}} r_{\mathrm{acc}}(y, G)
+
w_{\mathrm{fmt}} r_{\mathrm{fmt}}(y, G).
$$

In the main CCR experiments, the reward uses final-answer accuracy and format validity. It does not use a length reward, process reward, or benchmark-specific shaping.

The key technical object is the effective completed prefix. Let $$\ell_i(y)$$ denote the number of generated tokens spent on problem $$i$$, including reasoning and the final answer. Under a hard budget $$B_{\max}$$, define

$$
N_{\mathrm{eff}}(y)
=
\max
\left\{
k:
\sum_{i=1}^{k}\ell_i(y) \leq B_{\max}
\right\}.
$$

Only completed answers contribute to reward:

$$
r_{\mathrm{acc}}(y, G)
=
\frac{1}{N}
\sum_{i=1}^{N_{\mathrm{eff}}(y)}
X_i(y),
$$

where $$X_i(y)$$ is the correctness indicator for problem $$i$$. This convention makes opportunity cost measurable. If a verbose trajectory leaves fewer problems completed, it loses the reward terms for the displaced problems.

## 8. Proposition: useful compression is adaptive

The first CCR mechanism is easiest to see by comparing a concise trajectory $$y_c$$ and a verbose trajectory $$y_v$$. Suppose they have the same success probabilities on the problems they both complete, but the concise trajectory completes more problems:

$$
N_{\mathrm{eff}}(y_c) > N_{\mathrm{eff}}(y_v).
$$

Then the expected reward gap is

$$
\mathbb{E}[r_{\mathrm{acc}}(y_c, G)]
-
\mathbb{E}[r_{\mathrm{acc}}(y_v, G)]
=
\frac{1}{N}
\sum_{i=N_{\mathrm{eff}}(y_v)+1}^{N_{\mathrm{eff}}(y_c)}
\theta_i,
$$

where $$\theta_i$$ is the success probability on the additionally completed problems. If at least one of those displaced problems has positive probability of being solved, the concise trajectory is strictly better.

This is not a universal preference for short text. It is a preference for completions that preserve answerable problems. CCR taxes a token only through the answers it prevents from being completed.

Contrast that with an explicit length penalty. If adding $$\Delta \ell_i$$ useful tokens to problem $$i$$ improves success probability by $$\Delta \theta_i$$, then the explicit penalty changes reward by

$$
\Delta R_{\lambda}
=
\frac{\Delta \theta_i}{N}
-
\lambda \Delta \ell_i.
$$

The same edit under CCR has no length cost unless it displaces other problems. If no answer is displaced,

$$
\Delta R_{\mathrm{CCR}}
=
\frac{\Delta \theta_i}{N}.
$$

If the edit displaces a set $$D$$ of otherwise completed problems, then

$$
\Delta R_{\mathrm{CCR}}
=
\frac{1}{N}
\left(
\Delta \theta_i
-
\sum_{k\in D}\theta_k
\right).
$$

This is the adaptive part. Useful tokens are allowed; wasteful tokens become costly when they consume shared budget that could have bought other answers.

## 9. Reward-level stability: why grouping can help RL

CCR also explains why concurrent grouping can help training, not just inference. For a sampled completion $$j$$, write the correctness of problem $$i$$ as a Bernoulli variable:

$$
X_{i,j} \mid \theta_{i,j}
\sim
\mathrm{Bernoulli}(\theta_{i,j}).
$$

The group reward averages over $$N$$ such variables:

$$
r_{\mathrm{acc},j}
=
\frac{1}{N}
\sum_{i=1}^{N}
X_{i,j}.
$$

Write this as latent completion quality plus observation noise:

$$
r_{\mathrm{acc},j}
=
\bar{\theta}_j + \epsilon_j,
\quad
\bar{\theta}_j
=
\frac{1}{N}
\sum_{i=1}^{N}
\theta_{i,j}.
$$

Under conditional independence, the reward noise is bounded:

$$
\mathrm{Var}(\epsilon_j) \leq \frac{1}{4N}.
$$

The advantage used by group-relative RL is

$$
A_j
=
(\bar{\theta}_j - \bar{\theta}_{\mathrm{group}})
+
(\epsilon_j - \bar{\epsilon}_{\mathrm{group}}).
$$

If the latent quality gap across completions remains order one while the binary reward noise shrinks as $$1/N$$, the advantage signal-to-noise improves with concurrency:

$$
\mathrm{SNR}(A) = \Theta(N).
$$

This is the statistical upside of grouping. A single math problem gives a very sparse binary signal. A group of problems gives a denser estimate of whether one joint trajectory is better than another joint trajectory for the same group.

The caveat is essential: this only helps inside the feasible budget regime. If $$N$$ is too large, the group reward becomes noisy again for a different reason: the model cannot complete enough valid answers.

## 10. Update-level stability: averaging problem directions

CCR adds a second stability argument at the gradient level. Let $$g_i$$ denote the update direction induced by problem $$i$$, and suppose the grouped update can be approximated as an average:

$$
g_{\mathrm{CCR}}
\approx
w_{\mathrm{acc}}
\frac{1}{N}
\sum_{i=1}^{N}g_i.
$$

For any unit direction $$u$$, define the scalar projection

$$
Z_i = u^\top g_i.
$$

Assume

$$
\mathrm{Var}(Z_i) = \sigma_u^2,
\quad
\mathrm{Corr}(Z_i, Z_k) = \rho_u
\quad
(i\neq k).
$$

Then the projected variance of the grouped update is approximately

$$
\mathrm{Var}(u^\top g_{\mathrm{CCR}})
\approx
w_{\mathrm{acc}}^2\sigma_u^2
\left(
\rho_u
+
\frac{1-\rho_u}{N}
\right).
$$

The term that depends on $$N$$ is the non-shared part of the variance. If problem-level gradients are not perfectly correlated, increasing $$N$$ reduces the variable component. Intuitively, the group update averages away idiosyncratic noise from individual problems while preserving update components that are shared across the group.

Combining reward-level and update-level effects gives the training-time reason concurrency can help:

$$
\mathrm{SNR}_N(A) = \Theta(N),
\quad
\mathrm{Var}_N(u^\top g_{\mathrm{CCR}})
-
w_{\mathrm{acc}}^2\sigma_u^2\rho_u
\approx
w_{\mathrm{acc}}^2\sigma_u^2
\frac{1-\rho_u}{N}.
$$

Again, the statement is conditional. Larger $$N$$ helps statistically only while the model can still solve the group under the shared budget.

The training dynamics provide an empirical view of this interaction. Over roughly 1,000 optimization steps, the smoothed accuracy reward rises from about 0.13 to above 0.50, while the mean generated length falls from roughly 7.2K tokens to around 4.7K tokens before a modest late-stage rebound. The two improvements occur together even though length is not included as a direct reward term. This matters: the curve is inconsistent with a policy that merely learns to truncate. Instead, the policy is learning to allocate the shared context more effectively while improving correctness.

{% include figure.liquid path="assets/img/posts/bcr/ccr-training-curve.png" title="CCR training dynamics" class="img-fluid rounded z-depth-1" %}

_CCR training dynamics. Accuracy reward improves as average generation length decreases, illustrating emergent compression under a correctness-only group reward and a shared hard budget._

## 11. The CCR scaling law

The scaling question is: how large should $$N$$ be?

Let $$b_M(\delta,\tau)$$ be the approximate per-problem token budget model $$M$$ needs to retain accuracy within tolerance $$\delta$$ and complete at least a $$\tau$$ fraction of assigned problems. Under total budget $$B_{\max}$$, the feasible concurrent load satisfies

$$
N
\lesssim
N_{\max}(M;\delta,\tau)
=
\left\lfloor
\frac{B_{\max}}{b_M(\delta,\tau)}
\right\rfloor.
$$

Inside this feasible frontier, larger $$N$$ improves reward and update stability. Outside it, truncation and invalid shortcuts dominate. CCR therefore defines a feasible set

$$
\mathcal{F}_M(\delta,\tau)
=
\left\{
N:
\mathrm{Acc}_M(N)
\geq
\mathrm{Acc}_M(1)-\delta,
\quad
\mathbb{E}\left[
\frac{N_{\mathrm{eff}}}{N}
\right]
\geq
\tau
\right\}.
$$

Then define a throughput-efficiency objective

$$
T_M(N)
=
\frac{N\cdot \mathrm{Acc}_M(N)}
\mathbb{E}[L_M(N)].
$$

The Pareto-optimal concurrent task count is

$$
N^\star(M)
=
\arg\max_N T_M(N)
\quad
\mathrm{s.t.}
\quad
N\in \mathcal{F}_M(\delta,\tau).
$$

Within a related model family, parameter count can be used as a rough proxy for effective reasoning capability. CCR studies the local empirical rule

$$
N^\star(M)
\approx
\alpha \log P_M + \gamma.
$$

This should not be read as a universal law across all architectures and tasks. It is a local rule over the studied Qwen3-family range. The important conceptual claim is broader: **concurrent task count is a scaling variable**. It should move with model capability, task difficulty, and budget, rather than being fixed once for all models.

{% include figure.liquid path="assets/img/posts/bcr/ccr-scaling-curve.png" title="CCR scaling curves" class="img-fluid rounded z-depth-1" %}

<div class="caption">
CCR scaling curves. Stronger models sustain larger useful concurrency before the shared budget becomes harmful.
</div>

## 12. CCR empirical pattern across model sizes

CCR evaluates Qwen3-family models from 0.6B to 8B on nine mathematical reasoning benchmarks: AIME 2024/2025, AMC 2023, MATH-500, Minerva, Olympiad-Bench, BRUMO25, CMIMC25, and HMMT25.

The central pattern is nonmonotonic but structured:

- **0.6B** is near the boundary. Moving to $$N=2$$ reduces average tokens from 10,723 to 9,899, but average score drops from 31.3 to 28.8. The model does not have enough reasoning capacity to exploit concurrency reliably.
- **1.7B** benefits at $$N=2$$. Average score improves from 52.7 to 53.2, while average tokens drop from 11,527 to 9,756. Moving to $$N=3$$ saves more tokens but leaves the accuracy-retention regime.
- **4B-Thinking** shifts the sweet spot to $$N=3$$. Average score rises from 75.3 to 77.7, and average tokens drop from 15,336 to 11,914.
- **8B-ODA-Math** shifts further to $$N=4$$. Average score rises from 68.8 to 71.1, and average tokens drop from 13,042 to 9,868. At $$N=5$$, the budget becomes too tight and accuracy drops.

{% include figure.liquid path="assets/img/posts/bcr/ccr-main-table.png" title="CCR main benchmark table" class="img-fluid rounded z-depth-1" %}

<div class="caption">
CCR benchmark table over Qwen3-family models. The best useful concurrency increases with effective reasoning capability.
</div>

These results are exactly what the constrained view predicts. When a model has enough capability, concurrency removes redundant reasoning and stabilizes training. When concurrency is too high, the model no longer compresses waste; it skips essential structure.

The Pareto view makes this visible. A good CCR point moves up and left: higher or similar accuracy, fewer tokens. A bad CCR point bends downward: the budget per problem has become too small.

{% include figure.liquid path="assets/img/posts/bcr/ccr-pareto.png" title="CCR Pareto curves" class="img-fluid rounded z-depth-1" %}

<div class="caption">
CCR Pareto curves on representative benchmarks. Useful concurrency moves the point up-left; over-large concurrency bends the curve downward.
</div>

## 13. How to read BCR and CCR together

BCR and CCR are not two separate tricks. They are two views of the same phenomenon.

**BCR1 asks whether the phenomenon exists.** The answer is yes: grouped RL training can induce shorter reasoning that transfers to standard inference. This is surprising because the model is not explicitly rewarded for being short.

**CCR asks why and how far it scales.** The answer is that a shared hard budget creates adaptive opportunity cost, grouped rewards can improve advantage signal-to-noise, and averaged updates can reduce non-shared gradient variance. But these benefits exist only until the model hits the feasibility frontier.

The combined picture is:

$$
\text{shared budget}
\quad \Rightarrow \quad
\text{opportunity cost}
\quad \Rightarrow \quad
\text{syntactic compression}
\quad \Rightarrow \quad
\text{higher solved-problems-per-token}.
$$

This chain is different from direct length control:

$$
\text{length penalty}
\quad \Rightarrow \quad
\text{token aversion}
\quad \Rightarrow \quad
\text{truncation risk}
\quad \Rightarrow \quad
\text{optimization collapse}.
$$

The lesson is not that models should always be short. The lesson is that models should learn which tokens are worth spending. Shared-context training gives the model a reason to make that distinction.

## 14. What is coming next

BCR1 is available on arXiv and accepted to ICML 2026. CCR/BCR2 is currently under review, and I will add the arXiv link here once it is public. We also plan to release at least the 4B and 8B checkpoints on Hugging Face.

I am especially interested in extending concurrent constraint training beyond math. The same idea may apply to code generation, tool-use agents, symbolic planning, theorem proving, or scientific reasoning pipelines where answers are verifiable and long traces are common. The broader question is not simply how to make one answer shorter. It is how to train models that treat a shared budget as part of the task.
