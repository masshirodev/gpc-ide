<script lang="ts">
    import { onMount } from 'svelte';

    interface Props {
        points: { x: number; y: number }[];
        phasePoints: (number | null)[];
        pointPhaseMap: Map<number, number>;
        phaseColors: string[];
        mode: 'manual' | 'auto';
        drawPhase: 'draw' | 'phase';
        scale: number;
        hoveredPoint: number;
        canvasCenter: { x: number; y: number };
        onAddPoint: (x: number, y: number) => void;
        onAssignPhase: (pointIdx: number) => void;
    }

    let {
        points,
        phasePoints,
        pointPhaseMap,
        phaseColors,
        mode,
        drawPhase,
        scale,
        hoveredPoint = $bindable(-1),
        canvasCenter = $bindable({ x: 300, y: 300 }),
        onAddPoint,
        onAssignPhase
    }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let ctx: CanvasRenderingContext2D | null = null;

    function resize() {
        if (!canvas || !container) return;
        const rect = container.getBoundingClientRect();
        const size = Math.min(rect.width - 20, rect.height - 20);
        canvas.width = size;
        canvas.height = size;
        canvasCenter = { x: size / 2, y: size / 2 };
    }

    onMount(() => {
        ctx = canvas.getContext('2d');
        resize();
        const observer = new ResizeObserver(() => resize());
        observer.observe(container);
        return () => observer.disconnect();
    });

    // Redraw whenever any dependency changes
    $effect(() => {
        // Touch all dependencies to track them
        void points;
        void phasePoints;
        void pointPhaseMap;
        void hoveredPoint;
        void mode;
        void drawPhase;
        void canvasCenter;
        draw();
    });

    function draw() {
        if (!ctx || !canvas) return;
        const center = canvasCenter;
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = '#27272a'; // zinc-800
        ctx.lineWidth = 1;
        const gridStep = 20;
        for (let x = center.x % gridStep; x < w; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = center.y % gridStep; y < h; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Crosshair
        ctx.strokeStyle = '#3f3f46'; // zinc-700
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(center.x, 0);
        ctx.lineTo(center.x, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, center.y);
        ctx.lineTo(w, center.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center dot
        ctx.fillStyle = '#52525b'; // zinc-600
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
        ctx.fill();

        if (points.length === 0) return;

        // Lines connecting points
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Phase-colored segments
        for (let pi = 0; pi < 10; pi++) {
            if (phasePoints[pi] === null) continue;
            const startIdx = phasePoints[pi]!;

            let endIdx = points.length - 1;
            for (let j = pi + 1; j < 10; j++) {
                if (phasePoints[j] !== null) {
                    endIdx = phasePoints[j]!;
                    break;
                }
            }

            if (startIdx >= endIdx) continue;

            ctx.strokeStyle = phaseColors[pi] + '80';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(points[startIdx].x, points[startIdx].y);
            for (let k = startIdx + 1; k <= endIdx && k < points.length; k++) {
                ctx.lineTo(points[k].x, points[k].y);
            }
            ctx.stroke();
        }

        // Draw points
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const isManualPhase = phasePoints.includes(i);
            const manualPhaseIdx = phasePoints.indexOf(i);
            const autoPhaseIdx = pointPhaseMap.get(i);
            const hasPhaseColor = mode === 'auto' && autoPhaseIdx !== undefined;

            ctx.beginPath();
            ctx.arc(p.x, p.y, isManualPhase ? 7 : hasPhaseColor ? 5 : 4, 0, Math.PI * 2);

            if (isManualPhase && mode === 'manual') {
                ctx.fillStyle = phaseColors[manualPhaseIdx];
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Phase label
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`P${manualPhaseIdx}`, p.x, p.y - 12);
            } else if (hasPhaseColor) {
                ctx.fillStyle = phaseColors[autoPhaseIdx] + 'cc';
                ctx.fill();
                ctx.strokeStyle = phaseColors[autoPhaseIdx];
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (i === hoveredPoint && mode === 'manual' && drawPhase === 'phase') {
                ctx.fillStyle = '#ffb347';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else {
                ctx.fillStyle = '#52525b';
                ctx.fill();
            }

            // Point number for non-phase points
            if (!(isManualPhase && mode === 'manual')) {
                ctx.fillStyle = '#71717a';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(String(i + 1), p.x, p.y - 8);
            }
        }
    }

    function findClosestPoint(mx: number, my: number): number {
        let minDist = Infinity;
        let closest = -1;
        for (let i = 0; i < points.length; i++) {
            const dx = points[i].x - mx;
            const dy = points[i].y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist && dist < 20) {
                minDist = dist;
                closest = i;
            }
        }
        return closest;
    }

    function handleClick(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (mode === 'manual' && drawPhase === 'phase') {
            const idx = findClosestPoint(mx, my);
            if (idx >= 0) onAssignPhase(idx);
        } else {
            onAddPoint(mx, my);
        }
    }

    function handleMouseMove(e: MouseEvent) {
        if (mode !== 'manual' || drawPhase !== 'phase') {
            hoveredPoint = -1;
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        hoveredPoint = findClosestPoint(mx, my);
    }

    let cursorStyle = $derived(
        mode === 'manual' && drawPhase === 'phase' ? 'pointer' : 'crosshair'
    );
</script>

<div
    class="flex h-full items-center justify-center p-4"
    bind:this={container}
>
    <canvas
        bind:this={canvas}
        class="rounded-lg bg-zinc-950"
        style:cursor={cursorStyle}
        onclick={handleClick}
        onmousemove={handleMouseMove}
    ></canvas>
</div>
