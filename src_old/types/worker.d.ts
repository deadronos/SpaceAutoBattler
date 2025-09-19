declare module '*simWorker' {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}

declare module '*worker.ts' {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}
