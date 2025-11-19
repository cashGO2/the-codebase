---
title: Greedy Algorithm Codes
layout: post
date: '2025-07-28 17:43:26'
excerpt: This resource covers all the codes of greedy algorithms like krushkals, prims,
  knapsack problem etc.
visibility: private
category: Programming
summarize: true
semester: "5"
subject: "Design and Analysis of Algorithms"
---

## Dijkstra's Algorithm 

```C
#define MAX 100
#define INFINITY 9999

void dijkstra(int G[MAX][MAX], int n, int startnode) {
    int cost[MAX][MAX], distance[MAX], pred[MAX];
    int visited[MAX], count, mindistance, nextnode;
    int i, j;

    // Build cost matrix: use INFINITY where there is no edge
    for (i = 1; i <= n; i++)
        for (j = 1; j <= n; j++)
            if (G[i][j] == 0)
                cost[i][j] = INFINITY;
            else
                cost[i][j] = G[i][j];

    // Initialize distance, predecessor, visited
    for (i = 1; i <= n; i++) {
        distance[i] = cost[startnode][i];
        pred[i] = startnode;
        visited[i] = 0;
    }

    distance[startnode] = 0;
    visited[startnode] = 1;
    count = 1;

    // Find shortest paths to all other nodes
    while (count < n - 1) {
        mindistance = INFINITY;

        // Find the next unvisited node with smallest distance
        for (i = 1; i <= n; i++)
            if (distance[i] < mindistance && !visited[i]) {
                mindistance = distance[i];
                nextnode = i;
            }

        visited[nextnode] = 1;

        // Update distances of neighbors of nextnode
        for (i = 1; i <= n; i++)
            if (!visited[i])
                if (mindistance + cost[nextnode][i] < distance[i]) {
                    distance[i] = mindistance + cost[nextnode][i];
                    pred[i] = nextnode;
                }

        count++;
    }

    // Print the shortest path and distance to each node
    printf("Node\tDistance\tPath\n");
    for (i = 1; i <= n; i++) {
        if (i != startnode) {
            if (distance[i] == INFINITY) {
                printf("%4d\t%8s\tNO PATH\n", i, "INF");
            } else {
                printf("%4d\t%8d\t%d", i, distance[i], i);
                j = i;
                while (j != startnode) {
                    j = pred[j];
                    printf(" <- %d", j);
                }
                printf("\n");
            }
        }
    }
}
```

## Kruskal's Algorithm
A Minimum Spanning Tree (MST) is a tree that spans all the vertices of a connected, weighted graph with the minimum possible total edge weight. The key idea behind MST is to find a subset of edges that connects all vertices of the graph with the minimum total weight.



Consider the following example:
```TEXT
                    A
         /        \
      2          3
    /            \
   B--1---C---5---D  
    \            /
      4          6
       \         /
                   E
	```

In the given graph, we have vertices A, B, C, D, and E connected by weighted edges. We want to find the Minimum Spanning Tree for this graph.

To construct an MST, we choose a subset of edges that connects all vertices without forming any cycles. The resulting MST will have the minimum total weight.



Let's see one possible MST for the above graph:
```TEXT
             A
       /     \
      2       3
   /         \
  B---1---C  D  
   \                
    4         
      \       
        E
```

In the MST, we have removed certain edges to eliminate cycles and connect all the vertices. The total weight of this MST is 10.



Here are some key points about MST:

An MST is a spanning tree because it spans all the vertices of the graph.
It is a tree because there are no cycles in the MST.
It is a minimum spanning tree because it has the minimum total weight among all possible spanning trees.


To find the MST, various algorithms can be used, such as Kruskal's algorithm, Prim's algorithm, or Boruvka's algorithm. These algorithms differ in their approach and efficiency.



MSTs have applications in network design, clustering, and optimization problems. They help find the most efficient way to connect nodes in a network, minimizing the cost or distance between them.



Remember, an MST is not unique. In graphs with multiple edges or equal weights, there can be different MSTs with the same minimum total weight.

Spanning Tree

Given an undirected and connected graph G = (V, E), a spanning tree of the graph G is a tree that spans all vertices of G (that is, it includes every vertex of G) and is a subgraph of G (every edge in the tree belongs to G).



Cost of spanning tree

The cost of the spanning tree is the sum of the weights of all the edges in the spanning tree. There can be many spanning trees. The minimum spanning tree is the spanning tree where the cost is the minimum among all the spanning trees. There also can be many minimum spanning trees.



Minimum spanning tree has many applications in the design of networks. It is used in algorithms like the traveling salesman problem, multi-terminal minimum cut problem, and minimum cost weighted perfect matching.



Other practical applications are:

- Cluster Analysis
Handwriting recognition
Image segmentation


There are two famous algorithms for finding the Minimum Spanning Tree (MST):

Kruskal’s Algorithm
Prim’s Algorithm


Kruskal’s Algorithm

It builds the spanning tree by adding edges one by one into a growing spanning tree. Kruskal's algorithm follows the greedy approach as in each iteration it finds an edge that has least weight and adds it to the growing spanning tree.



Algorithm:

Initialization:
Set ne (number of edges included in the MST) to 0.
Initialize mincost (the minimum cost of the spanning tree) to 0.
Initialize parent[] array to store the parent of each vertex, initially set all values to 0.

Main Loop:
While ne (number of edges in the MST) is less than n-1 (number of vertices - 1):
Find the minimum weight edge:
Set min to a very large value (e.g., 999).
For each vertex i from 1 to n:
For each vertex j from 1 to n:
If cost[i][j] is less than min:
Set min to cost[i][j].
Set a and u to i.
Set b and v to j.
Check for cycle using find function:
Call find(u) to get the root of vertex u.
Call find(v) to get the root of vertex v.
Union of sets:
If find(u) is not equal to find(v):
Call uni(u, v) to perform union of sets containing u and v.
Print the edge and its cost.
Add the min to mincost.
Increment ne by 1.

Remove the edge from the cost matrix:
Set cost[a][b] and cost[b][a] to a very large value (e.g., 999) to mark the edge as visited.
Output the result:
Print the mincost which is the cost of the minimum spanning tree.


Helper Functions:
Find Function:
Input: A vertex i.
While parent[i] is not 0:
Set i to parent[i].
Return i
Union Function:
Input: Vertices i and j.
If i is not equal to j:
Set parent[j] to i.
Return 1 (indicating a successful union).
Return 0 (indicating that i and j are already in the same set).


This algorithm effectively finds the minimum spanning tree using Kruskal's method by iteratively selecting the smallest edge and ensuring no cycles are formed using the union-find data structure.

### C program for constructing a minimum cost spanning tree of a graph using Kruskal’s Algorithm.
```C
#include <stdio.h>

#define MAX 9
#define INF 999

int cost[MAX][MAX], parent[MAX];
int i, j, a, b, u, v, n, e, s, d, w;
int mincost = 0, ne = 1;

// Find root of the set
int find(int i) {
    while (parent[i])
        i = parent[i];
    return i;
}

// Union two sets
int uni(int i, int j) {
    if (i != j) {
        parent[j] = i;
        return 1;
    }
    return 0;
}

void kruskal() {
    while (ne < n) {
        int min = INF;

        for (i = 1; i <= n; i++) {
            for (j = 1; j <= n; j++) {
                if (cost[i][j] < min) {
                    min = cost[i][j];
                    a = u = i;
                    b = v = j;
                }
            }
        }

        u = find(u);
        v = find(v);

        if (uni(u, v)) {
            printf("Edge %d: (%d -> %d) cost = %d\n", ne++, a, b, min);
            mincost += min;
        }

        cost[a][b] = cost[b][a] = INF; // Mark edge as visited
    }

    printf("Minimum cost of spanning tree = %d\n", mincost);
}

int main() {
    printf("Enter the number of vertices: ");
    scanf("%d", &n);

    printf("Enter the number of edges: ");
    scanf("%d", &e);

    // Initialize cost matrix to INF
    for (i = 1; i <= n; i++)
        for (j = 1; j <= n; j++)
            cost[i][j] = INF;

    for (i = 1; i <= e; i++) {
        printf("Edge %d\n", i);
        printf("  Enter source: ");
        scanf("%d", &s);
        printf("  Enter destination: ");
        scanf("%d", &d);
        printf("  Enter weight: ");
        scanf("%d", &w);

        if (s <= 0 || d <= 0 || s > n || d > n || w < 0) {
            printf("  Invalid input! Try again.\n");
            i--;
            continue;
        }

        cost[s][d] = cost[d][s] = w; // Undirected graph
    }

    printf("\nThe edges of the Minimum Cost Spanning Tree are:\n");
    kruskal();

    return 0;
}
```

## Prim's Algorithm
```C

#include<stdio.h>
#include<conio.h>

#define MAX 20

int cost[MAX][MAX];     // Adjacency matrix
int visited[MAX];       // Visited vertices
int n, e;               // Number of vertices and edges
int s, d, w;            // Source, destination, weight
int i, j;               // Loop variables
int a, b;               // For storing edge ends
int min;                // Minimum edge cost
int ne = 1;             // Edge count initialized to 1
int mincost = 0; 
// complete the missing code..
void prims() {
    visited[1] = 1;
    while (ne < n) {
        min = 999;
        for (i = 1; i <= n; i++) {
            if (visited[i] == 1) {
                for (j = 1; j <= n; j++) {
                    if (visited[j] == 0 && cost[i][j] < min) {
                        min = cost[i][j];
                        a = i;
                        b = j;
                    }
                }
            }
        }
        printf("Edge cost from %d to %d : %d\n", a, b, cost[a][b]);
        visited[b] = 1;
        mincost += cost[a][b];
        cost[a][b] = cost[b][a] = 999;
        ne++;
    }
    printf("Minimum cost of spanning tree = %d\n", mincost);
}
void main() {
	printf("Enter the number of vertices : ");
	scanf("%d", &n);
	printf("Enter the number of edges : ");
	scanf("%d", &e);
	for(i=1; i<=e; i++) {
		printf("Enter source : ");
		scanf("%d", &s);
		printf("Enter destination : ");
		scanf("%d", &d);
		printf("Enter weight : ");
		scanf("%d", &w);
		if(s <= 0 || d <= 0 || s > n || d > n || w < 0 ) {
			printf("Invalid data.Try again.\n");
			i--;
			continue;
		}
		cost[s][d] = w;
		cost[d][s] = w;
	}
	for(i=1; i <= n; i++) {
	    for(j=1; j<=n; j++) {
			if(cost[i][j] == 0)
			    cost[i][j] = 999;
	    }
	}
	printf("The edges of Minimum Cost Spanning Tree are : \n");
	prims();
}
```

## Knapsack Problem
```C
# include<stdio.h>
void knapsack(int n, float weight[], float profit[], float capacity) {
  // write your code here
  float x[20], tp = 0;
	int i, j, u;
	u = capacity;
	for (i = 0; i < n; i++)
		x[i] = 0.0;
		for (i = 0; i < n; i++) {
			if (weight[i] > u)
				break;
			else {
				x[i] = 1.0;
				tp = tp + profit[i];
				u = u - weight[i];
			}
		}
	if (i < n)
		x[i] = u / weight[i];
		tp = tp + (x[i] * profit[i]);
		printf("Maximum profit is:- %f\n", tp);
  
  
  
}

int main() {
	float weight[20], profit[20], capacity;
	int num, i, j;
	float ratio[20], temp;
	printf("Enter the no. of objects: ");
	scanf("%d", &num);
	printf("Enter the weights and profits of each object:\n");
	for (i = 0; i < num; i++) {
		scanf("%f %f", &weight[i], &profit[i]);
	}
	printf("Enter the capacity of knapsack:");
	scanf("%f", &capacity);
	for (i = 0; i < num; i++) {
		ratio[i] = profit[i] / weight[i];
	}

	for (i = 0; i < num; i++) {
		for (j = i + 1; j < num; j++) {
			if (ratio[i] < ratio[j]) {
				temp = ratio[j];
				ratio[j] = ratio[i];
				ratio[i] = temp;
				temp = weight[j];
				weight[j] = weight[i];
				weight[i] = temp;
				temp = profit[j];
				profit[j] = profit[i];
				profit[i] = temp;
			}
		}
	}
	knapsack(num, weight, profit, capacity);
	return(0);
}
```
