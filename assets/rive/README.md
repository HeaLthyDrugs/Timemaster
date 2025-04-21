# Using Rive Animations in TimeMaster

This guide will help you integrate Rive animations into your TimeMaster app.

## What is Rive?

Rive is a platform for creating and implementing interactive animations. Animations created in Rive can be exported as `.riv` files and used across different platforms, including React Native.

## Getting Started

We've created a reusable `RiveAnimation` component that makes it easy to add Rive animations to any screen in the app.

### Using Remote Animations

You can use animations directly from the Rive community:

```jsx
import RiveAnimation from '~/components/RiveAnimation';
import { Fit, Alignment } from 'rive-react-native';

// In your component:
<RiveAnimation
  source="https://rive.app/community/3482-7805-rocket/"
  width={300}
  height={300}
  fit={Fit.Contain}
  alignment={Alignment.Center}
/>
```

### Using Local Animations

For production, it's recommended to download the `.riv` files and include them in your assets:

1. Download the `.riv` file from Rive
2. Place it in the `assets/rive` directory
3. Use it in your component:

```jsx
import RiveAnimation from '~/components/RiveAnimation';

// In your component:
<RiveAnimation
  source="your_animation_filename" // without .riv extension
  width={300}
  height={300}
/>
```

### State Machines

For interactive animations, you can use state machines:

```jsx
<RiveAnimation
  source="your_animation"
  stateMachine="StateMachineName"
  width={300}
  height={300}
/>
```

## Demo

Check out the Rive demo page at `/examples/rive-demo` to see working examples and experiment with different animations.

## Best Practices

1. **File Size**: Keep animations small (under 500KB) for better performance
2. **State Machines**: Use state machines for interactive animations
3. **Fallbacks**: Always have a fallback UI in case the animation fails to load
4. **Performance**: For complex animations, test performance on older devices
5. **Local Files**: Use local files instead of remote URLs in production

## Finding Animations

1. Visit [Rive's Community](https://rive.app/community)
2. Browse or search for animations
3. Copy the URL or download the `.riv` file
4. Try it in the demo page first to ensure it works as expected

## Adding Animation to Empty States

Rive animations are perfect for empty states or loading screens. For example:

```jsx
{data.length === 0 ? (
  <View style={styles.emptyState}>
    <RiveAnimation
      source="empty_state_animation"
      width={200}
      height={200}
    />
    <Text style={styles.emptyText}>No data available</Text>
  </View>
) : (
  // Your regular content
)}
```

## Troubleshooting

If animations aren't working:

1. Verify the URL or file path is correct
2. Check that the state machine name is spelled correctly (if using one)
3. Try a simpler animation to rule out performance issues
4. Check the Rive documentation for any API changes 