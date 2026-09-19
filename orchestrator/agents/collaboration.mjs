import { AgentGraph } from "../core/agent-graph.mjs";

export class Collaboration {
  constructor(graph) {
    this.graph = graph;
  }

  async run({ input, executor, reviewer }) {
    this.graph.addNode({ id: "executor", run: executor });
    this.graph.addNode({ id: "reviewer", dependsOn: ["executor"], run: reviewer });
    return this.graph.run(input);
  }

  async execute(mode, request, invokeOne) {
    const runOne = async (label) => {
      const result = await invokeOne({
        ...request,
        preferredProvider: request.preferredProvider,
        taskClass: request.taskClass
      });
      return { label, ...result };
    };

    if (mode === "sequential" || mode === "planner-executor" || mode === "researcher-synthesizer") {
      const first = await runOne("stage-1");
      const second = await invokeOne({
        ...request,
        messages: [
          ...(request.messages ?? []),
          { role: "assistant", content: first.text },
          {
            role: "user",
            content:
              mode === "researcher-synthesizer"
                ? "Synthesize the research into a final answer."
                : "Execute the plan and produce the final answer."
          }
        ]
      });
      return {
        ...second,
        text: second.text,
        collaboration: { mode, stages: [first, second] }
      };
    }

    if (mode === "parallel") {
      const graph = new AgentGraph({ maxParallel: request.maxParallel ?? 2 });
      graph.addNode({ id: "a", run: async () => runOne("a") });
      graph.addNode({ id: "b", run: async () => runOne("b") });
      const results = await graph.run(request);
      return {
        ...results.a,
        text: `A:\n${results.a.text}\n\nB:\n${results.b.text}`,
        collaboration: { mode, stages: [results.a, results.b] }
      };
    }

    if (mode === "debate" || mode === "critic" || mode === "multi") {
      const first = await runOne("proposal");
      const critique = await invokeOne({
        ...request,
        messages: [
          ...(request.messages ?? []),
          { role: "assistant", content: first.text },
          { role: "user", content: "Critique the previous answer. Identify gaps, then produce a stronger final answer." }
        ]
      });
      return {
        ...critique,
        collaboration: { mode, stages: [first, critique] }
      };
    }

    const result = await runOne("single");
    return { ...result, collaboration: { mode: "single", stages: [result] } };
  }
}
