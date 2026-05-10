---
layout: page
title: M3
description: Multi-modal, multi-agent, multi-round visual reasoning for text-to-image generation.
img: assets/img/publication_preview/M3.png
importance: 2
category: research
related_publications: true
---

M3 is a closed-loop framework for high-fidelity text-to-image generation. It uses planner, verifier, checker, refiner, and editor roles to identify spatial or physical failures, generate targeted refinement instructions, and iteratively improve an image at inference time.

The system is designed for cases where a first-pass text-to-image model produces visually plausible output but misses compositional details in the prompt.

{% include figure.liquid path="assets/img/publication_preview/M3.png" title="M3 overview" class="img-fluid rounded z-depth-1" %}

<div class="caption">
Representative figure for the M3 iterative visual reasoning pipeline.
</div>
