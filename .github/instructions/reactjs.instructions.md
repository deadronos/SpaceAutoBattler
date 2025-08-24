---
description: 'ReactJS development standards and best practices'
applyTo: '**/*.jsx, **/*.tsx, **/*.js, **/*.ts, **/*.css, **/*.scss'
---

type Props = { title: string; onClick?: () => void };
	return (
		<article>
			<h3>{title}</h3>
			<button onClick={onClick}>Action</button>
		</article>
	);
	const [count, setCount] = useState(initial);
	useEffect(() => { /* side-effects */ }, [count]);
	return { count, inc: () => setCount(c => c + 1) };

# React — Short Guide

Receipt: "Implement a small React feature/component."

Plan: 1) Props/types. 2) Functional component. 3) Hooks for logic. 4) RTL tests.

Checklist:
- [ ] Functional components + hooks
- [ ] All state via canonical GameState if simulation
- [ ] Behavior tested (RTL)

End.
