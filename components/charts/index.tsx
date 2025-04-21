import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  Canvas,
  Path,
  vec,
  Circle,
  SweepGradient,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { TimeSession } from '~/types/timeSession';

// Screen dimensions
const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48; // Accounting for padding
const CHART_HEIGHT = 220;
const PADDING = 16;

// Colors based on the app's theme
const COLORS = {
  clarity: {
    light: '#dbeafe',
    dark: '#1e3a8a',
    main: '#A0D2FF',
    grad1: '#A0D2FF',
    grad2: '#80C2FF',
  },
  lost: {
    light: '#fce7f3',
    dark: '#9d174d',
    main: '#FFBFC8',
    grad1: '#FFBFC8',
    grad2: '#FFA0B0',
  },
  body: { 
    light: '#d1fae5',
    dark: '#065f46',
    main: '#BBFFCC',
    grad1: '#BBFFCC',
    grad2: '#A0FFB8',
  },
  text: {
    light: '#1f2937',
    dark: '#f9fafb',
  },
  background: {
    light: '#fafaff',
    dark: '#1e1e1e',
  },
  tabActive: {
    light: '#f0f9ff',
    dark: '#172554',
  },
  tabInactive: {
    light: '#e5e7eb',
    dark: '#111827',
  },
  tabTextActive: {
    light: '#1e40af',
    dark: '#93c5fd',
  },
  tabTextInactive: {
    light: '#6b7280',
    dark: '#9ca3af',
  },
};

// Filter period options
const FILTER_PERIODS = ['Today', '7 Days', '30 Days'] as const;
type FilterPeriod = typeof FILTER_PERIODS[number];

// Props interface
interface ChartsProps {
  timeData: {
    clarity: number;
    lost: number;
    body: number;
  };
  sessions: TimeSession[];
}

// Format minutes to readable time
const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Process data based on selected period
const processTimePeriod = (sessions: TimeSession[], period: FilterPeriod): {
  clarity: number;
  lost: number;
  body: number;
} => {
  if (!sessions || sessions.length === 0) {
    return { clarity: 0, lost: 0, body: 0 };
}

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate = new Date(today);
  
  if (period === '7 Days') {
    startDate.setDate(today.getDate() - 6);
  } else if (period === '30 Days') {
    startDate.setDate(today.getDate() - 29);
  }
  
  // Tomorrow
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 1);
  
  // Filter sessions based on the date range
  const filteredSessions = sessions.filter(session => {
    if (session.deleted) return false;
    
    // Ensure we're working with date objects
    const sessionStart = session.startTime instanceof Date 
      ? session.startTime 
      : new Date(session.startTime);
    
    const sessionEnd = session.endTime
      ? (session.endTime instanceof Date ? session.endTime : new Date(session.endTime))
      : new Date();
    
    // Check if session overlaps with the period
    return (sessionStart >= startDate && sessionStart < endDate) || 
           (sessionEnd >= startDate && sessionEnd < endDate) ||
           (sessionStart < startDate && sessionEnd >= endDate);
  });
  
  // Calculate time spent in each category
  let clarityTime = 0;
  let lostTime = 0;
  let bodyTime = 0;
  
  filteredSessions.forEach(session => {
    // Make sure we're working with date objects
    const sessionStart = session.startTime instanceof Date 
      ? session.startTime 
      : new Date(session.startTime);
      
    // Use end time if available, otherwise use current time for active sessions
    const sessionEnd = session.endTime
      ? (session.endTime instanceof Date ? session.endTime : new Date(session.endTime))
      : new Date();
    
    // Calculate overlap with the period
    const overlapStart = sessionStart < startDate ? startDate : sessionStart;
    const overlapEnd = sessionEnd > endDate ? endDate : sessionEnd;
    
    // Calculate milliseconds elapsed
    let ms = 0;
    
    if (overlapStart < overlapEnd) {
      ms = overlapEnd.getTime() - overlapStart.getTime();
    }
    
    // Categorize the time
    switch (session.category.toLowerCase()) {
      case 'goal':
        clarityTime += ms;
        break;
      case 'lost':
        lostTime += ms;
        break;
      case 'health':
        bodyTime += ms;
        break;
      default:
        // Unknown category, ignore
        break;
    }
  });
  
  return { clarity: clarityTime, lost: lostTime, body: bodyTime };
};

const Charts = ({ timeData, sessions }: ChartsProps) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // State for filter period and animation tracking
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('Today');
  const [hasError, setHasError] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  
  // Special identifier to track data changes
  const dataIdRef = useRef(0);
  
  // Animation value - only used once per data change
  const animationProgress = useSharedValue(0);
  
  // Process time data based on the selected filter period
  const processedTimeData = useMemo(() => {
    try {
      // If Today is selected, use the provided timeData
      if (filterPeriod === 'Today') {
        return timeData;
      }
      
      // Otherwise, process sessions based on the selected period
      return processTimePeriod(sessions, filterPeriod);
    } catch (error) {
      console.error('Error processing time data:', error);
      setHasError(true);
      return { clarity: 0, lost: 0, body: 0 };
    }
  }, [timeData, sessions, filterPeriod]);
  
  // Calculate total minutes for donut chart
  const totalMinutes = useMemo(() => {
    const total = processedTimeData.clarity + processedTimeData.lost + processedTimeData.body;
    return total || 1; // Prevent division by zero
  }, [processedTimeData]);
  
  // Calculate percentages for donut chart
  const percentages = useMemo(() => {
    const total = totalMinutes;
    return {
      clarity: (processedTimeData.clarity / total) * 100,
      lost: (processedTimeData.lost / total) * 100,
      body: (processedTimeData.body / total) * 100
    };
  }, [processedTimeData, totalMinutes]);
  
  // Format times for display
  const formattedTimes = useMemo(() => {
    return {
      clarity: formatTime(Math.round(processedTimeData.clarity / (1000 * 60))),
      lost: formatTime(Math.round(processedTimeData.lost / (1000 * 60))),
      body: formatTime(Math.round(processedTimeData.body / (1000 * 60)))
    };
  }, [processedTimeData]);
  
  // Memoize chart values to avoid recalculations and worklet issues
  const chartValues = useMemo(() => {
    return {
      clarityPercent: percentages.clarity,
      lostPercent: percentages.lost,
      bodyPercent: percentages.body,
      dataId: ++dataIdRef.current // Increment data ID to track changes
    };
  }, [percentages]);
  
  // Function to handle filter period change
  const handleFilterPeriodChange = useCallback((period: FilterPeriod) => {
    setFilterPeriod(period);
    // Reset animation state when filter changes
    setIsAnimated(false);
  }, []);
  
  // Function to mark animation as completed
  const markAnimationComplete = useCallback(() => {
    setIsAnimated(true);
  }, []);
  
  // Trigger animation ONLY when data changes AND animation hasn't run yet
  useEffect(() => {
    // Skip animation if it already ran for this data
    if (isAnimated) {
      return;
    }
    
    // Reset animation value
    animationProgress.value = 0;
    
    // Start animation with a small delay
    const timer = setTimeout(() => {
      animationProgress.value = withTiming(1, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }, (finished) => {
        if (finished) {
          runOnJS(markAnimationComplete)();
        }
      });
    }, 50);
    
    return () => clearTimeout(timer);
  }, [animationProgress, chartValues.dataId, isAnimated, markAnimationComplete]);
  
  // Error state fallback UI
  if (hasError) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={{color: isDark ? '#f9fafb' : '#333'}}>
          There was an error rendering the chart. Please try again.
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setHasError(false)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Component for filter period tabs
  const FilterTabs = () => (
    <View style={styles.filterTabsContainer}>
      {FILTER_PERIODS.map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.filterTab,
            filterPeriod === period && styles.activeFilterTab,
            { backgroundColor: filterPeriod === period ? 
              (isDark ? COLORS.tabActive.dark : COLORS.tabActive.light) : 
              (isDark ? COLORS.tabInactive.dark : COLORS.tabInactive.light) }
          ]}
          onPress={() => handleFilterPeriodChange(period)}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: filterPeriod === period ? 
                (isDark ? COLORS.tabTextActive.dark : COLORS.tabTextActive.light) : 
                (isDark ? COLORS.tabTextInactive.dark : COLORS.tabTextInactive.light) }
            ]}
          >
            {period}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  
  // Helper for polar to cartesian conversion
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    'worklet';
    const angleInRadians = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };
  
  // Create paths for each segment
  const makeArc = (startAngle: number, endAngle: number, centerX: number, centerY: number, radius: number, innerRadius: number): string => {
    'worklet';
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const innerStart = polarToCartesian(centerX, centerY, innerRadius, endAngle);
    const innerEnd = polarToCartesian(centerX, centerY, innerRadius, startAngle);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    
    return `
      M ${start.x} ${start.y}
      A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}
      L ${innerEnd.x} ${innerEnd.y}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y}
      Z
    `;
  };
  
  // Center coordinates
  const centerX = CHART_WIDTH / 2;
  const centerY = CHART_HEIGHT / 2;
  const radius = Math.min(centerX, centerY) - 40;
  const innerRadius = radius * 0.65;
  
  // Calculate angles for segments - using fixed shared values to avoid recomputation
  const clarityAngle = useDerivedValue(() => {
    'worklet';
    return 360 * (chartValues.clarityPercent / 100) * animationProgress.value;
  });
  
  const lostAngle = useDerivedValue(() => {
    'worklet';
    return 360 * (chartValues.lostPercent / 100) * animationProgress.value;
  });
  
  const bodyAngle = useDerivedValue(() => {
    'worklet';
    return 360 * (chartValues.bodyPercent / 100) * animationProgress.value;
  });
  
  // Calculate paths for each segment
  const clarityPath = useDerivedValue(() => {
    'worklet';
    return makeArc(0, clarityAngle.value, centerX, centerY, radius, innerRadius);
  });
  
  const lostPath = useDerivedValue(() => {
    'worklet';
    return makeArc(clarityAngle.value, clarityAngle.value + lostAngle.value, centerX, centerY, radius, innerRadius);
  });
  
  const bodyPath = useDerivedValue(() => {
    'worklet';
    return makeArc(
      clarityAngle.value + lostAngle.value,
      clarityAngle.value + lostAngle.value + bodyAngle.value,
      centerX, centerY, radius, innerRadius
    );
  });
  
  // Legend component for donut chart
  const Legend = ({ color, label, value, percentage }: { 
    color: string; 
    label: string; 
    value: string;
    percentage: number;
  }) => (
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: color }]} />
      <View style={styles.legendTextContainer}>
        <Text style={[styles.legendLabel, { color: isDark ? '#f9fafb' : '#333' }]}>
          {label}
        </Text>
        <Text style={[styles.legendValue, { color: isDark ? '#d1d5db' : '#666' }]}>
          {value} {percentage > 0 && `(${percentage.toFixed(1)}%)`}
        </Text>
      </View>
    </View>
  );
            
            return (
    <View style={[styles.container, { backgroundColor: isDark ? COLORS.background.dark : COLORS.background.light }]}>
      {/* Period filter */}
      <FilterTabs />
      
      {/* Donut chart */}
      <View style={styles.donutChartContainer}>
        <Canvas style={styles.canvas}>
          {/* Clarity segment */}
          {processedTimeData.clarity > 0 && (
            <Path
              path={clarityPath}
              color={isDark ? COLORS.clarity.dark : COLORS.clarity.light}
            >
              <SweepGradient
                c={vec(centerX, centerY)}
                    colors={[COLORS.clarity.grad1, COLORS.clarity.grad2]}
                  />
            </Path>
          )}
          
          {/* Lost segment */}
          {processedTimeData.lost > 0 && (
            <Path
              path={lostPath}
              color={isDark ? COLORS.lost.dark : COLORS.lost.light}
            >
              <SweepGradient
                c={vec(centerX, centerY)}
                    colors={[COLORS.lost.grad1, COLORS.lost.grad2]}
                  />
            </Path>
          )}
          
          {/* Body segment */}
          {processedTimeData.body > 0 && (
            <Path
              path={bodyPath}
              color={isDark ? COLORS.body.dark : COLORS.body.light}
            >
              <SweepGradient
                c={vec(centerX, centerY)}
                    colors={[COLORS.body.grad1, COLORS.body.grad2]}
                  />
            </Path>
          )}
          
          {/* Center circle */}
          <Circle cx={centerX} cy={centerY} r={innerRadius} color={isDark ? COLORS.background.dark : 'white'} />
        </Canvas>
        
        {/* Legend */}
        <View style={styles.legendContainer}>
          <Legend 
            color={isDark ? COLORS.clarity.dark : COLORS.clarity.light} 
            label="Clarity" 
            value={formattedTimes.clarity}
            percentage={percentages.clarity}
          />
          <Legend 
            color={isDark ? COLORS.body.dark : COLORS.body.light} 
            label="Body" 
            value={formattedTimes.body}
            percentage={percentages.body}
          />
          <Legend 
            color={isDark ? COLORS.lost.dark : COLORS.lost.light} 
            label="Lost" 
            value={formattedTimes.lost}
            percentage={percentages.lost}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: PADDING,
    borderRadius: 12,
    marginBottom: 16,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeFilterTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  filterTabText: {
    fontWeight: '500',
  },
  donutChartContainer: {
    height: CHART_HEIGHT + 70, // Make room for legend
    width: '100%',
  },
  canvas: {
    height: CHART_HEIGHT,
    width: '100%',
  },
  legendContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 14,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default Charts;
