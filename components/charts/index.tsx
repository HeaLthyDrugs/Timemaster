import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { TimeSession } from '~/types/timeSession';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';

// Screen dimensions
const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48; // Accounting for padding
const CHART_HEIGHT = 240;
const CHART_SIZE = Math.min(CHART_WIDTH, CHART_HEIGHT);
const PADDING = 16;

// Colors based on the app's theme
const COLORS = {
  clarity: {
    light: '#dbeafe',
    dark: '#1e3a8a',
    main: '#A0D2FF',
  },
  lost: {
    light: '#fce7f3',
    dark: '#9d174d',
    main: '#FFBFC8',
  },
  body: { 
    light: '#d1fae5',
    dark: '#065f46',
    main: '#BBFFCC',
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
const FILTER_PERIODS = ['7 Days', '30 Days', 'All Time'] as const;
type FilterPeriod = typeof FILTER_PERIODS[number];

// Props interface
interface ChartsProps {
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

// Converts polar coordinates to cartesian
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

// Creates an SVG arc path
function describeArc(x: number, y: number, radius: number, innerRadius: number, startAngle: number, endAngle: number) {
  // Ensure we have valid angles
  startAngle = Math.max(startAngle, 0);
  endAngle = Math.min(endAngle, 359.999); // Avoid full circle which can cause rendering issues
  
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);
  
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  // Create the path
  const d = [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "L", innerEnd.x, innerEnd.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
    "Z"
  ].join(" ");
  
  return d;
}

// Define interface for chart segment
interface ChartSegment {
  path: string;
  color: string;
  hasData: boolean;
  label?: string;
  value?: string;
  percentage?: number;
}

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
  } else if (period === 'All Time') {
    // For all time, use a very old date to include everything
    startDate = new Date(0);
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

const Charts = ({ sessions }: ChartsProps) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // State for filter period and error handling
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('7 Days');
  const [hasError, setHasError] = useState(false);
  
  // Process time data based on the selected filter period
  const processedTimeData = useMemo(() => {
    try {
      return processTimePeriod(sessions, filterPeriod);
    } catch (error) {
      console.error('Error processing time data:', error);
      setHasError(true);
      return { clarity: 0, lost: 0, body: 0 };
    }
  }, [sessions, filterPeriod]);
  
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
  
  // Colors for the chart - alternate between light and dark based on theme
  const chartColors = useMemo(() => [
    isDark ? COLORS.clarity.dark : COLORS.clarity.light,
    isDark ? COLORS.body.dark : COLORS.body.light,
    isDark ? COLORS.lost.dark : COLORS.lost.light
  ], [isDark]);
  
  // Handle filter period changes
  const handleFilterChange = useCallback((period: FilterPeriod) => {
    if (filterPeriod !== period) {
      setFilterPeriod(period);
    }
  }, [filterPeriod]);
  
  // Total time formatted for center display
  const totalTimeFormatted = formatTime(Math.round(totalMinutes / (1000 * 60)));
  
  // Generate pie segments for the chart
  const pieSegments = useMemo<ChartSegment[]>(() => {
    const centerX = CHART_SIZE / 2;
    const centerY = CHART_SIZE / 2;
    const outerRadius = CHART_SIZE * 0.4; // 80% of half the chart size
    const innerRadius = CHART_SIZE * 0.2; // 40% of half the chart size
    
    // If no data, return a placeholder
    if (totalMinutes <= 1) {
      return [{
        path: describeArc(centerX, centerY, outerRadius, innerRadius, 0, 359.99),
        color: isDark ? '#4B5563' : '#E5E7EB',
        hasData: false
      }];
    }
    
    const segments: ChartSegment[] = [];
    let startAngle = 0;
    
    // Add Clarity segment
    if (processedTimeData.clarity > 0) {
      const endAngle = startAngle + (percentages.clarity * 3.6); // 3.6 = 360 / 100
      segments.push({
        path: describeArc(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle),
        color: chartColors[0],
        label: 'Clarity',
        value: formattedTimes.clarity,
        percentage: percentages.clarity,
        hasData: true
      });
      startAngle = endAngle;
    }
    
    // Add Body segment
    if (processedTimeData.body > 0) {
      const endAngle = startAngle + (percentages.body * 3.6);
      segments.push({
        path: describeArc(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle),
        color: chartColors[1],
        label: 'Body',
        value: formattedTimes.body,
        percentage: percentages.body,
        hasData: true
      });
      startAngle = endAngle;
    }
    
    // Add Lost segment
    if (processedTimeData.lost > 0) {
      const endAngle = startAngle + (percentages.lost * 3.6);
      segments.push({
        path: describeArc(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle),
        color: chartColors[2],
        label: 'Lost',
        value: formattedTimes.lost,
        percentage: percentages.lost,
        hasData: true
      });
    }
    
    return segments;
  }, [percentages, chartColors, processedTimeData, totalMinutes, formattedTimes, isDark]);
  
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
  
  // Component for filter tabs
  const FilterTabs = () => (
    <View style={styles.tabContainer}>
      {FILTER_PERIODS.map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.tabButton,
            {
              backgroundColor:
                filterPeriod === period
                  ? isDark
                    ? COLORS.tabActive.dark
                    : COLORS.tabActive.light
                  : isDark
                  ? COLORS.tabInactive.dark
                  : COLORS.tabInactive.light,
            },
          ]}
          onPress={() => handleFilterChange(period)}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  filterPeriod === period
                    ? isDark
                      ? COLORS.tabTextActive.dark
                      : COLORS.tabTextActive.light
                    : isDark
                    ? COLORS.tabTextInactive.dark
                    : COLORS.tabTextInactive.light,
              },
            ]}
          >
            {period}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  
  // Custom Legend component
  const Legend = ({ color, label, value, percentage }: { 
    color: string; 
    label: string; 
    value: string;
    percentage: number;
  }) => (
    <View style={styles.legendRow}>
      <View style={[styles.colorIndicator, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: isDark ? '#f9fafb' : '#1f2937' }]}>{label}</Text>
      <Text style={[styles.legendValue, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
        {value} {percentage > 0 && `(${percentage.toFixed(1)}%)`}
      </Text>
    </View>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: isDark ? COLORS.background.dark : COLORS.background.light }]}>
      {/* Period filter */}
      <FilterTabs />
      
      {/* Donut chart */}
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          {/* SVG-based Donut Chart */}
          <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
            {/* Draw segments */}
            {pieSegments.map((segment, index) => (
              <Path
                key={index}
                d={segment.path}
                fill={segment.color}
                stroke="none"
              />
            ))}
            
            {/* Center Text */}
            <SvgText
              x={CHART_SIZE / 2}
              y={CHART_SIZE / 2 - 10}
              fontSize="14"
              fontWeight="normal"
              fill={isDark ? '#f9fafb' : '#1f2937'}
              textAnchor="middle"
              opacity={0.8}
            >
              Total Time
            </SvgText>
            <SvgText
              x={CHART_SIZE / 2}
              y={CHART_SIZE / 2 + 15}
              fontSize="18"
              fontWeight="bold"
              fill={isDark ? '#f9fafb' : '#1f2937'}
              textAnchor="middle"
            >
              {totalTimeFormatted}
            </SvgText>
          </Svg>
        </View>
        
        {/* Legend */}
        <View style={styles.legendContainer}>
          {pieSegments.length > 0 && pieSegments.map((segment, index) => (
            segment.hasData && (
              <Legend 
                key={index}
                color={segment.color}
                label={segment.label || ''}
                value={segment.value || ''}
                percentage={segment.percentage || 0}
              />
            )
          ))}
          
          {/* Placeholder for empty state */}
          {pieSegments.length === 1 && !pieSegments[0].hasData && (
            <Text style={{
              textAlign: 'center',
              color: isDark ? '#f9fafb' : '#1f2937',
              marginTop: 10
            }}>
              No data for this period
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  chartContainer: {
    height: CHART_HEIGHT + 100,
    width: CHART_WIDTH,
    alignItems: 'center',
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: CHART_SIZE,
    marginTop: 10,
  },
  legendContainer: {
    marginTop: 20,
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontWeight: '500',
  },
  errorContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
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
