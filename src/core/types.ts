export type NodeId = string;

export type ElementId = string;

export type TwoTerminal = {
  a: NodeId;
  b: NodeId;
};

export type Resistor = {
  kind: "R";
  id: ElementId;
  a: NodeId;
  b: NodeId;
  ohms: number;
  // Convention for current reporting: positive current flows from a -> b
};

export type VSource = {
  kind: "V";
  id: ElementId;
  a: NodeId; // positive terminal at node a
  b: NodeId; // negative terminal at node b
  volts: number;
  // Positive current variable defined flowing from a -> b through the source
};

export type ISource = {
  kind: "I";
  id: ElementId;
  a: NodeId; // current flows from a -> b
  b: NodeId;
  amps: number;
};

export type Element = Resistor | VSource | ISource;

export type Circuit = {
  nodes: NodeId[];
  elements: Element[];
  // terminals for Req measurement
  terminals?: { A: NodeId; B: NodeId };
};

export type Solution = {
  // node voltages relative to internal reference (refNode)
  refNode: NodeId;
  V: Record<NodeId, number>;
  // element currents by convention described per element
  I: Record<ElementId, number>;
};

export type ValidationTargets = {
  // Voltage differences Vab targets
  voltages: Array<{ id: string; a: NodeId; b: NodeId; label?: string }>;
  // Currents through each resistor
  currents: Array<{ elementId: ElementId; label?: string }>;
  // Equivalent resistance between A and B
  req?: { A: NodeId; B: NodeId };
};
