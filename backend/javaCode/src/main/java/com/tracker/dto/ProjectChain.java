package com.tracker.dto;

import java.util.List;

/**
 * A project's place in the chain: upstream = projects it waits on (directly or not),
 * downstream = projects that wait on it.
 */
public record ProjectChain(List<ProjectLink> upstream, List<ProjectLink> downstream) {}
