package com.tracker.util;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dependency graphs (milestones or projects): id -> ids it depends on.
 */
public final class Graphs {
    private Graphs() {}

    /** True if `from` depends on `target`, directly or through others. Used to refuse loops. */
    public static boolean reaches(Map<Long, Set<Long>> graph, long from, long target) {
        Deque<Long> toVisit = new ArrayDeque<>(List.of(from));
        Set<Long> seen = new HashSet<>();
        while (!toVisit.isEmpty()) {
            long current = toVisit.pop();
            if (current == target) return true;
            if (!seen.add(current)) continue;
            toVisit.addAll(graph.getOrDefault(current, Set.of()));
        }
        return false;
    }

    /** Everything `start` depends on, directly or not, nearest first. */
    public static Set<Long> allReachable(Map<Long, Set<Long>> graph, long start) {
        Set<Long> found = new LinkedHashSet<>();
        Deque<Long> toVisit = new ArrayDeque<>(graph.getOrDefault(start, Set.of()));
        while (!toVisit.isEmpty()) {
            long current = toVisit.removeFirst();
            if (current == start || !found.add(current)) continue;
            toVisit.addAll(graph.getOrDefault(current, Set.of()));
        }
        return found;
    }

    /** The same graph with every arrow turned around: id -> ids that depend on it. */
    public static Map<Long, Set<Long>> reversed(Map<Long, Set<Long>> graph) {
        Map<Long, Set<Long>> reversed = new HashMap<>();
        graph.forEach((from, tos) -> tos.forEach(to -> reversed.computeIfAbsent(to, k -> new HashSet<>()).add(from)));
        return reversed;
    }
}
