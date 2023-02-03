import { IExecutor } from './Executor';
import ITask from './Task';

export default async function run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
    maxThreads = Math.max(0, maxThreads);
    /**
     * Код надо писать сюда
     * Тут что-то вызываем в правильном порядке executor.executeTask для тасков из очереди queue
     */

    type TasksOrder = {
        [action: string]: {
            [id: number]: ITask
        }
    }

    type TasksCount = {
        tasksInOrder: number,

        init: number,
        prepare: number,
        work: number,
        finalize: number,
        cleanup: number
    }

    class Order {
        private static _list: TasksOrder = {
            init: {},
            prepare: {},
            work: {},
            finalize: {},
            cleanup: {}
        }
        private static _executing: Set<number> = new Set()
        private static _unprocessed: number = 0

        private static _tasksCount: TasksCount = {
            tasksInOrder: 0,

            init: 0,
            prepare: 0,
            work: 0,
            finalize: 0,
            cleanup: 0
        }

        static handleTask(task: ITask) {
            if (task == undefined) return
            
            Order._unprocessed++

            if (!Order._executing.has(task.targetId) && (Order._executing.size < maxThreads && maxThreads !== 0 || maxThreads === 0)) {
                Order._execute(task)
            } else {
                Order._insertTaskIntoOrder(task)
            }
        }

        private static async _execute(task: ITask | undefined) {
            if (task == undefined) return
            
            Order._executing.add(task.targetId)
            await executor.executeTask(task)
            Order._executing.delete(task.targetId)

            Order._unprocessed--

            Order._execute(Order._getTaskToExecute())
        }

        private static _getTaskToExecute(): ITask | undefined {
            for (let action in Order._list) {
                for (let id in Order._list[action]) {
                    if (Order._executing.has(+id)) continue

                    const task = Order._list[action][id]

                    Order._removeTaskFromOrder(task)
                    
                    return task
                }
            }
        }

        private static _insertTaskIntoOrder(task: ITask) {
            Order._list[task.action][task.targetId] = task
            Order._tasksCount[task.action]++
            Order._tasksCount.tasksInOrder++
        }

        private static _removeTaskFromOrder(task: ITask) {
            delete Order._list[task.action][task.targetId]
            Order._tasksCount.tasksInOrder--
            Order._tasksCount[task.action]--
        }

        static async shortStop() {
            await new Promise<void>(r => setTimeout(function stop() {
                if (Order.containsNotInitiatedID()) {
                    /**
                     * Если в очереди ожидает начала выполнения задание с task.action равному 'init',
                     * цикл остановится до момента пока это задание не попоадет на выполнение.
                     * Предотвращает чрезмерное заполнение очереди задач.
                     */
                    setTimeout(stop)
                } else {
                    r()
                }
            }))
        }

        static containsNotInitiatedID(): boolean {
            if (Order._tasksCount.init > 0) {
                return true
            }

            return false
        }

        static get unprocessedTasksAmount() {
            return Order._unprocessed
        }
    }

    let iterator = queue[Symbol.asyncIterator]()
    let iteration = await iterator.next()
    let done = iteration.done
    let task = iteration.value
    while (!done || Order.unprocessedTasksAmount !== 0) {
        Order.handleTask(task)

        if (Order.containsNotInitiatedID() || done) {
            /**
             * Необходимо прерывать цикл, чтобы освобождать потоки от выполненых заданий
             * 
             * Если queue закончилась, то происходят остановки цикла для возможности отследить выпоненные задачи.
             * 
             * В случае, если в очереди ожидает начала выполнения задание с task.action равному 'init',
             * остановка цикла поможет избежать слишком быстрого наполнения очереди.
             */
            await Order.shortStop()
        }

        if (done && !Order.containsNotInitiatedID()) {
            iterator = queue[Symbol.asyncIterator]()
        }

        iteration = await iterator.next()
        done = iteration.done
        task = iteration.value
    }
}
